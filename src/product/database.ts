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
` }, { version: 4, sql: `
  CREATE UNIQUE INDEX calendar_series_owner_id ON calendar_series(owner_id,id);
  CREATE TABLE calendar_overrides (
    owner_id TEXT NOT NULL, series_id TEXT NOT NULL, recurrence_id TEXT NOT NULL,
    payload TEXT NOT NULL CHECK(json_valid(payload)),
    FOREIGN KEY(owner_id,series_id) REFERENCES calendar_series(owner_id,id) ON DELETE CASCADE,
    PRIMARY KEY(owner_id,series_id,recurrence_id)
  );
` }, { version: 5, sql: `
  CREATE TABLE campus_entries (id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)), version INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE campus_bookmarks (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_kind TEXT NOT NULL CHECK(target_kind IN ('place','shuttle')), target_id TEXT NOT NULL,
    created_at INTEGER NOT NULL, PRIMARY KEY(owner_id,target_kind,target_id)
  );
  CREATE TABLE campus_corrections (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_kind TEXT NOT NULL CHECK(target_kind IN ('place','shuttle')), target_id TEXT NOT NULL,
    message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','rejected')),
    resolution TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
    request_key TEXT NOT NULL, UNIQUE(owner_id,request_key)
  );
` }, { version: 6, sql: `
  CREATE TABLE activities (
    id TEXT PRIMARY KEY, organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL CHECK(json_valid(payload)), visibility TEXT NOT NULL CHECK(visibility IN ('public','members')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','cancelled')),
    moderation_state TEXT NOT NULL DEFAULT 'visible' CHECK(moderation_state IN ('visible','hidden')),
    starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, is_demo INTEGER NOT NULL DEFAULT 1 CHECK(is_demo=1)
  );
  CREATE INDEX activities_start ON activities(starts_at,id);
  CREATE TABLE activity_participations (
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('confirmed','waitlisted','withdrawn','cancelled')),
    queue_order INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1, joined_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY(activity_id,user_id), UNIQUE(activity_id,queue_order)
  );
  CREATE TABLE activity_preferences (
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bookmarked INTEGER NOT NULL DEFAULT 0, calendar_saved INTEGER NOT NULL DEFAULT 0, remind_minutes INTEGER,
    PRIMARY KEY(activity_id,user_id)
  );
  CREATE TABLE activity_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
    moderation_state TEXT NOT NULL DEFAULT 'visible' CHECK(moderation_state IN ('visible','hidden'))
  );
  CREATE INDEX activity_comments_feed ON activity_comments(activity_id,id);
  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
    kind TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER
  );
  CREATE INDEX notifications_owner_feed ON notifications(owner_id,id);

` }, { version: 7, sql: `
  CREATE TABLE wall_posts (
    id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('wall','help')), title TEXT NOT NULL, body TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK(visibility IN ('public','members')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','closed')),
    moderation_state TEXT NOT NULL DEFAULT 'visible' CHECK(moderation_state IN ('visible','hidden')),
    version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 1 CHECK(is_demo=1)
  );
  CREATE TABLE wall_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT, post_id TEXT NOT NULL REFERENCES wall_posts(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL,
    moderation_state TEXT NOT NULL DEFAULT 'visible' CHECK(moderation_state IN ('visible','hidden')),
    version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
  );
  CREATE INDEX wall_replies_feed ON wall_replies(post_id,id);
  ALTER TABLE notifications ADD COLUMN post_id TEXT REFERENCES wall_posts(id) ON DELETE SET NULL;
  CREATE TABLE user_blocks (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL,
    PRIMARY KEY(owner_id,target_id), CHECK(owner_id!=target_id)
  );
  CREATE TABLE content_reports (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_kind TEXT NOT NULL CHECK(target_kind IN ('post','reply','activity','activity_comment')),
    target_id TEXT NOT NULL, target_author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL, details TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','dismissed','action_taken')),
    version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
    resolution TEXT NOT NULL DEFAULT '', reviewed_at INTEGER, reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, UNIQUE(owner_id,request_key)
  );
  CREATE TABLE moderation_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT REFERENCES content_reports(id) ON DELETE SET NULL,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL
  );

` }, { version: 8, sql: `
  ALTER TABLE campus_corrections ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE campus_corrections ADD COLUMN reviewed_at INTEGER;
  ALTER TABLE campus_corrections ADD COLUMN reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL;
  CREATE TABLE campus_source_checks (
    id TEXT PRIMARY KEY, target_kind TEXT NOT NULL, target_id TEXT NOT NULL,
    url TEXT NOT NULL, sha256 TEXT NOT NULL, retrieved_at INTEGER NOT NULL,
    body TEXT NOT NULL, actor_id TEXT REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE campus_maintenance_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, target_kind TEXT NOT NULL, target_id TEXT NOT NULL,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL,
    reason TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL,
    source_check_id TEXT REFERENCES campus_source_checks(id), created_at INTEGER NOT NULL
  );
` }, { version: 9, sql: `
  CREATE TABLE shuttle_catalog (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)));
` }, { version: 10, sql: `
  CREATE TABLE activity_maintenance_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, reason TEXT NOT NULL, fields_json TEXT NOT NULL,
    before_version INTEGER NOT NULL, after_version INTEGER NOT NULL, created_at INTEGER NOT NULL
  );
` }, { version: 11, sql: `
  CREATE TABLE school_connections (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK(provider IN ('sis','canvas')), subject TEXT NOT NULL,
    consent_version TEXT NOT NULL, approval_reference TEXT NOT NULL,
    generation INTEGER NOT NULL, version INTEGER NOT NULL, revoked_at INTEGER,
    PRIMARY KEY(owner_id,provider)
  );
  CREATE TABLE school_scopes (
    owner_id TEXT NOT NULL, provider TEXT NOT NULL, scope_id TEXT NOT NULL,
    state TEXT NOT NULL, last_attempt_at INTEGER, last_success_at INTEGER,
    error_code TEXT, active_run TEXT, lease_until INTEGER,
    PRIMARY KEY(owner_id,provider,scope_id),
    FOREIGN KEY(owner_id,provider) REFERENCES school_connections(owner_id,provider) ON DELETE CASCADE
  );
  CREATE TABLE school_records (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, provider TEXT NOT NULL, scope_id TEXT NOT NULL,
    remote_key TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
    source_state TEXT NOT NULL CHECK(source_state IN ('active','cancelled','removed')),
    source_updated_at TEXT, source_seen_at INTEGER NOT NULL, version INTEGER NOT NULL,
    UNIQUE(owner_id,provider,scope_id,remote_key), UNIQUE(owner_id,id),
    FOREIGN KEY(owner_id,provider,scope_id) REFERENCES school_scopes(owner_id,provider,scope_id) ON DELETE CASCADE
  );
  CREATE INDEX school_records_owner ON school_records(owner_id,id);
  CREATE TABLE school_personal (
    record_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, notes TEXT NOT NULL,
    completed INTEGER NOT NULL CHECK(completed IN (0,1)), remind_minutes INTEGER, version INTEGER NOT NULL,
    FOREIGN KEY(owner_id,record_id) REFERENCES school_records(owner_id,id) ON DELETE CASCADE
  );
` }, { version: 12, sql: `
 CREATE TABLE reconnection_intents (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  willing INTEGER NOT NULL CHECK(willing IN (0,1)),
  version INTEGER NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  PRIMARY KEY(owner_id,target_id,activity_id), CHECK(owner_id!=target_id)
 );
 CREATE TRIGGER revoke_reconnections_on_block AFTER INSERT ON user_blocks BEGIN
  UPDATE reconnection_intents SET willing=0,version=version+1,updated_at=NEW.created_at
  WHERE (owner_id=NEW.owner_id AND target_id=NEW.target_id) OR (owner_id=NEW.target_id AND target_id=NEW.owner_id);
 END;
` }, { version: 13, sql: `
 CREATE TABLE reconnection_cards (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  text TEXT NOT NULL, version INTEGER NOT NULL, own_consent INTEGER NOT NULL, peer_consent INTEGER NOT NULL,
  PRIMARY KEY(owner_id,target_id,activity_id)
 );
 CREATE TRIGGER clear_reconnection_cards AFTER UPDATE ON reconnection_intents BEGIN
  UPDATE reconnection_cards SET text='',version=version+1
  WHERE activity_id=NEW.activity_id AND ((owner_id=NEW.owner_id AND target_id=NEW.target_id) OR (owner_id=NEW.target_id AND target_id=NEW.owner_id));
 END;
` }, { version: 14, sql: `
 ALTER TABLE reconnection_cards ADD COLUMN id TEXT;
 UPDATE reconnection_cards SET id=lower(hex(randomblob(16)));
 CREATE UNIQUE INDEX reconnection_card_id ON reconnection_cards(id);
 CREATE TABLE content_reports_v2 (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK(target_kind IN ('post','reply','activity','activity_comment','contact_card')),
  target_id TEXT NOT NULL, target_author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL, details TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','dismissed','action_taken')),
  version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
  resolution TEXT NOT NULL DEFAULT '', reviewed_at INTEGER, reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, UNIQUE(owner_id,request_key)
 );
 INSERT INTO content_reports_v2 SELECT * FROM content_reports;
 CREATE TABLE moderation_audit_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT REFERENCES content_reports_v2(id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL
 );
 INSERT INTO moderation_audit_v2 SELECT * FROM moderation_audit;
 DROP TABLE moderation_audit;
 DROP TABLE content_reports;
 ALTER TABLE content_reports_v2 RENAME TO content_reports;
 ALTER TABLE moderation_audit_v2 RENAME TO moderation_audit;
` }, { version: 15, sql: `
 ALTER TABLE notifications ADD COLUMN reconnection_target TEXT REFERENCES users(id) ON DELETE CASCADE;
 CREATE UNIQUE INDEX reconnection_notice_pair ON notifications(owner_id,activity_id,reconnection_target) WHERE kind='reconnection_mutual';
 CREATE TRIGGER clear_reconnection_notices AFTER UPDATE ON reconnection_intents WHEN NEW.willing=0 BEGIN
  DELETE FROM notifications WHERE kind='reconnection_mutual' AND activity_id=NEW.activity_id
  AND ((owner_id=NEW.owner_id AND reconnection_target=NEW.target_id) OR (owner_id=NEW.target_id AND reconnection_target=NEW.owner_id));
 END;
` }, { version: 16, sql: `
 CREATE TABLE affair_templates (
  id TEXT PRIMARY KEY, current_revision INTEGER NOT NULL, retired_at INTEGER, retired_by TEXT
 );
 CREATE TABLE affair_revisions (
  template_id TEXT NOT NULL REFERENCES affair_templates(id), revision INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)), reviewer TEXT NOT NULL, published_at INTEGER NOT NULL,
  PRIMARY KEY(template_id,revision)
 );
 CREATE TABLE affair_instances (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL, accepted_revision INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)), version INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  FOREIGN KEY(template_id,accepted_revision) REFERENCES affair_revisions(template_id,revision)
 );
 CREATE INDEX affair_owner_list ON affair_instances(owner_id,archived,created_at,id);
 CREATE TABLE affair_acknowledgements (
  instance_id TEXT NOT NULL REFERENCES affair_instances(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), created_at INTEGER NOT NULL,
  PRIMARY KEY(instance_id,version)
 );
 CREATE TABLE affair_receipts (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, scope TEXT NOT NULL, key TEXT NOT NULL,
  fingerprint TEXT NOT NULL, instance_id TEXT NOT NULL, result_version INTEGER NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(owner_id,scope,key)
 );
` }, { version: 17, sql: `
 ALTER TABLE affair_instances ADD COLUMN reported_at INTEGER;
 ALTER TABLE affair_instances ADD COLUMN outcome_recorded_at INTEGER;
` }, { version: 18, sql: `
 ALTER TABLE wall_posts ADD COLUMN topic TEXT NOT NULL DEFAULT 'share' CHECK(topic IN ('question','share','buddy','market'));
 UPDATE wall_posts SET topic='question' WHERE kind='help';
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
