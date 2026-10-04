import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './database.js';
import { ApiError } from './errors.js';

type Challenge = { id: string; email: string; code_hash: string; attempts: number; expires_at: number; consumed_at: number | null };
export type Principal = { id: string; email: string; role: 'admin' | 'member'; signedInAt: number };
const digest = (s: string) => createHash('sha256').update(s).digest('hex');

export function createAuth(db: DatabaseSync, dataDir: string, now: () => number, schoolStates: (owner:string)=>{sis:string;canvas:string} = () => ({sis:'approval_required',canvas:'approval_required'})) {
  const secretPath = join(dataDir, 'auth-secret');
  if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(32), { mode: 0o600, flag: 'wx' });
  chmodSync(secretPath, 0o600);
  const secret = readFileSync(secretPath);
  const mailDir = join(dataDir, 'mail');
  mkdirSync(mailDir, { recursive: true, mode: 0o700 });
  const mac = (s: string) => createHmac('sha256', secret).update(s).digest('hex');
  const mailPath = (id: string) => join(mailDir, `${id}.json`);
  const removeMail = (id: string) => rmSync(mailPath(id), { force: true });

  function prune() {
    const expired = db.prepare('SELECT id FROM challenges WHERE expires_at<=? OR consumed_at IS NOT NULL OR attempts>=5').all(now());
    for (const c of expired) removeMail(String(c.id));
    db.prepare('DELETE FROM auth_requests WHERE created_at<=?').run(now() - 3600_000);
    db.prepare('DELETE FROM sessions WHERE expires_at<=? OR last_used_at<=?').run(now(), now() - 1800_000);
    db.prepare('DELETE FROM challenges WHERE created_at<?').run(now() - 86400_000);
  }
  prune();

  function challenge(email: string, ip: string) {
    prune();
    return transaction(db, () => {
      const latest = db.prepare('SELECT created_at FROM challenges WHERE email=? ORDER BY created_at DESC LIMIT 1').get(email);
      if (latest && now() - Number(latest.created_at) < 60_000) {
        throw new ApiError(429, 'RATE_LIMITED', 'Please wait before requesting another code.', Math.ceil((Number(latest.created_at) + 60_000 - now()) / 1000));
      }
      const ipHash = mac(`ip:${ip}`);
      const requests = db.prepare('SELECT count(*) AS n FROM auth_requests WHERE ip_hash=? AND created_at>?').get(ipHash, now() - 3600_000);
      if (Number(requests!.n) >= 10) throw new ApiError(429, 'RATE_LIMITED', 'Development login request limit reached.', 3600);
      const id = randomUUID();
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expiresAt = now() + 600_000;
      // A new challenge invalidates the previous code, including its local mail.
      const previous = db.prepare('SELECT id FROM challenges WHERE email=? AND consumed_at IS NULL').all(email);
      db.prepare('UPDATE challenges SET consumed_at=? WHERE email=? AND consumed_at IS NULL').run(now(), email);
      db.prepare('INSERT INTO challenges (id,email,code_hash,created_at,expires_at) VALUES (?,?,?,?,?)').run(id, email, mac(`${id}:${code}`), now(), expiresAt);
      db.prepare('INSERT INTO auth_requests VALUES (?,?)').run(ipHash, now());
      writeFileSync(mailPath(id), JSON.stringify({ development_only: true, email, code, expires_at: new Date(expiresAt).toISOString() }), { mode: 0o600, flag: 'wx' });
      for (const c of previous) removeMail(String(c.id));
      return { challenge_id: id, expires_at: new Date(expiresAt).toISOString(), delivery: 'local_development_inbox', retry_after_seconds: 60 };
    });
  }

  function verify(id: string, code: string) {
    // Return failure values from the transaction so failed-attempt counters commit.
    const result = transaction(db, () => {
      const c = db.prepare('SELECT * FROM challenges WHERE id=?').get(id) as Challenge | undefined;
      if (!c || c.consumed_at !== null || c.expires_at <= now() || c.attempts >= 5) {
        return new ApiError(410, 'CHALLENGE_UNAVAILABLE', 'Request a new login code.');
      }
      if (!timingSafeEqual(Buffer.from(c.code_hash, 'hex'), Buffer.from(mac(`${id}:${code}`), 'hex'))) {
        db.prepare('UPDATE challenges SET attempts=attempts+1 WHERE id=?').run(id);
        return new ApiError(401, 'INVALID_CODE', 'The code is not valid.');
      }
      const existing = db.prepare('SELECT id,banned_at FROM users WHERE email=?').get(c.email);
      if (existing?.banned_at !== null && existing?.banned_at !== undefined) return new ApiError(403, 'ACCOUNT_RESTRICTED', 'This account is restricted.');
      const userId = existing ? String(existing.id) : randomUUID();
      if (!existing) db.prepare('INSERT INTO users (id,email,created_at) VALUES (?,?,?)').run(userId, c.email, now());
      db.prepare('UPDATE challenges SET consumed_at=? WHERE id=?').run(now(), id);
      const token = randomBytes(32).toString('base64url');
      const expiresAt = now() + 12 * 3600_000;
      db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(digest(token), userId, now(), now(), expiresAt);
      return { access_token: token, token_type: 'Bearer', expires_at: new Date(expiresAt).toISOString(), development_only: true };
    });
    prune();
    if (result instanceof ApiError) throw result;
    return result;
  }

  /** Personal read-only API tokens ("ustl_…") for the student's own AI tools. Stored hashed; shown once. */
  const personal = /^Bearer (ustl_[A-Za-z0-9_-]{43})$/;
  function createToken(user: string, name: string) {
    if (Number(db.prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE user_id=?').get(user)!.n) >= 5) throw new ApiError(409, 'TOKEN_LIMIT', 'Revoke an old connection first (max 5).');
    const token = 'ustl_' + randomBytes(32).toString('base64url'), id = randomUUID(); // release-check:allow (freshly generated random token, returned once)
    db.prepare('INSERT INTO api_tokens(id,user_id,name,token_hash,created_at) VALUES (?,?,?,?,?)').run(id, user, name, digest(token), now());
    return { id, name, token, scope: 'read', created_at: new Date(now()).toISOString() };
  }
  function listTokens(user: string) {
    return (db.prepare('SELECT id,name,created_at,last_used_at FROM api_tokens WHERE user_id=? ORDER BY created_at DESC').all(user) as { id: string; name: string; created_at: number; last_used_at: number | null }[])
      .map(r => ({ id: r.id, name: r.name, scope: 'read', created_at: new Date(Number(r.created_at)).toISOString(), last_used_at: r.last_used_at == null ? null : new Date(Number(r.last_used_at)).toISOString() }));
  }
  function revokeToken(user: string, id: string) {
    if (!db.prepare('DELETE FROM api_tokens WHERE id=? AND user_id=?').run(id, user).changes) throw new ApiError(404, 'TOKEN_NOT_FOUND', 'Connection not found.');
    return { id, revoked: true };
  }
  const isPersonalToken = (authorization?: string) => personal.test(authorization ?? '');

  function requireUser(authorization?: string): Principal {
    const key = personal.exec(authorization ?? '')?.[1];
    if (key) {
      const row = db.prepare('SELECT u.id,u.email,u.role,u.banned_at,t.id AS token_id,t.created_at FROM api_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=?').get(digest(key));
      if (!row) throw new ApiError(401, 'TOKEN_REVOKED', 'This connection was revoked.');
      if (row.banned_at !== null) throw new ApiError(403, 'ACCOUNT_RESTRICTED', 'This account is restricted.');
      db.prepare('UPDATE api_tokens SET last_used_at=? WHERE id=?').run(now(), String(row.token_id));
      return { id: String(row.id), email: String(row.email), role: 'member', signedInAt: 0 };
    }
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization ?? '')?.[1];
    if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    const hash = digest(token);
    const row = db.prepare(`SELECT u.id,u.email,u.role,u.banned_at,s.created_at,s.last_used_at,s.expires_at
      FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).get(hash);
    if (!row || Number(row.expires_at) <= now() || Number(row.last_used_at) + 1800_000 <= now()) {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);
      throw new ApiError(401, 'SESSION_EXPIRED', 'Please sign in again.');
    }
    if (row.banned_at !== null) throw new ApiError(403, 'ACCOUNT_RESTRICTED', 'This account is restricted.');
    db.prepare('UPDATE sessions SET last_used_at=? WHERE token_hash=?').run(now(), hash);
    return { id: String(row.id), email: String(row.email), role: row.role as Principal['role'], signedInAt: Number(row.created_at) };
  }

  function profile(id: string) {
    const row = db.prepare('SELECT id,email,display_name,language,role,membership,is_demo,created_at FROM users WHERE id=?').get(id)!;
    return { ...row, is_demo: row.is_demo === 1, created_at: new Date(Number(row.created_at)).toISOString(),
      connections: { school_sso: 'approval_required', ...schoolStates(id), outlook: 'approval_required' } };
  }
  function logout(authorization: string) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(authorization.slice(7))); }
  function deleteAccount(user: Principal, beforeDelete?: () => void) {
    if (now() - user.signedInAt > 600_000) throw new ApiError(403, 'REAUTH_REQUIRED', 'Sign in again before deleting your account.');
    const mails = db.prepare('SELECT id FROM challenges WHERE email=?').all(user.email);
    transaction(db, () => {
      beforeDelete?.();
      db.prepare('DELETE FROM challenges WHERE email=?').run(user.email);
      db.prepare('DELETE FROM users WHERE id=?').run(user.id);
    });
    for (const c of mails) removeMail(String(c.id));
  }
  return { challenge, verify, requireUser, profile, logout, deleteAccount, createToken, listTokens, revokeToken, isPersonalToken };
}
