import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const migrations = [{ version: 1, sql: `
  CREATE TABLE users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'zh' CHECK(language IN ('zh','en')),
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
    membership TEXT NOT NULL DEFAULT 'unknown' CHECK(membership = 'unknown'),
    is_demo INTEGER NOT NULL DEFAULT 1 CHECK(is_demo = 1), created_at INTEGER NOT NULL,
    banned_at INTEGER
  );
  CREATE TABLE challenges (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, consumed_at INTEGER
  );
  CREATE INDEX challenges_email_created ON challenges(email, created_at);
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE auth_requests (ip_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE INDEX auth_requests_ip_created ON auth_requests(ip_hash, created_at);
` }, { version: 2, sql: `
  CREATE TABLE study_courses (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL CHECK(json_valid(payload)), version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(owner_id,id)
  );
  CREATE TABLE study_items (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT, kind TEXT NOT NULL CHECK(kind IN ('event','task','note','material')),
    payload TEXT NOT NULL CHECK(json_valid(payload)), version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    FOREIGN KEY(owner_id,course_id) REFERENCES study_courses(owner_id,id) DEFERRABLE INITIALLY DEFERRED
  );
  CREATE INDEX study_items_owner_kind ON study_items(owner_id,kind,id);
  CREATE INDEX study_items_course ON study_items(owner_id,course_id);
  CREATE TABLE write_keys (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL,
    resource_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
    PRIMARY KEY(owner_id,scope,key)
  );
` }, { version: 3, sql: `
  CREATE TABLE calendar_sources (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
    UNIQUE(owner_id,id)
  );
  CREATE TABLE calendar_series (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, source_id TEXT NOT NULL,
    uid TEXT NOT NULL, definition TEXT NOT NULL CHECK(json_valid(definition)),
    version INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(owner_id,source_id) REFERENCES calendar_sources(owner_id,id) ON DELETE CASCADE,
    UNIQUE(owner_id,source_id,uid)
  );
  CREATE TABLE calendar_previews (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), expires_at INTEGER NOT NULL,
    confirmation TEXT, result TEXT
  );
  CREATE INDEX calendar_previews_owner ON calendar_previews(owner_id,expires_at);
` }];

export function transaction<T>(db: DatabaseSync, action: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const value = action(); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function openDatabase(dataDir: string) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  chmodSync(dataDir, 0o700);
  const filename = join(dataDir, 'campus.sqlite');
  const db = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
  for (const migration of migrations) {
    if (db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(migration.version)) continue;
    transaction(db, () => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(migration.version, Date.now());
    });
  }
  return db;
}
