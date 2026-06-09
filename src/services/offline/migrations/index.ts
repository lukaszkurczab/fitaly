export type Migration = { version: number; up: string };

export const migrations: Migration[] = [
  {
    version: 1,
    up: `
CREATE TABLE IF NOT EXISTS meals (
  cloud_id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT,
  ingredients TEXT,
  photo_url TEXT,
  image_local TEXT,
  image_id TEXT,
  totals_kcal REAL DEFAULT 0,
  totals_protein REAL DEFAULT 0,
  totals_carbs REAL DEFAULT 0,
  totals_fat REAL DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at INTEGER NOT NULL DEFAULT 0,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  source TEXT,
  input_method TEXT,
  ai_meta TEXT,
  notes TEXT,
  tags TEXT
);
CREATE INDEX IF NOT EXISTS idx_meals_user_ts ON meals(user_uid, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_meals_user_del_ts ON meals(user_uid, deleted, timestamp DESC);

CREATE TABLE IF NOT EXISTS my_meals (
  cloud_id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT,
  ingredients TEXT,
  photo_url TEXT,
  image_local TEXT,
  image_id TEXT,
  totals_kcal REAL DEFAULT 0,
  totals_protein REAL DEFAULT 0,
  totals_carbs REAL DEFAULT 0,
  totals_fat REAL DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_synced_at INTEGER NOT NULL DEFAULT 0,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  source TEXT,
  input_method TEXT,
  ai_meta TEXT,
  notes TEXT,
  tags TEXT
);
CREATE INDEX IF NOT EXISTS idx_my_meals_user_name
  ON my_meals(user_uid, name COLLATE NOCASE ASC, cloud_id ASC);
CREATE INDEX IF NOT EXISTS idx_my_meals_user_updated
  ON my_meals(user_uid, updated_at ASC, cloud_id ASC);

CREATE TABLE IF NOT EXISTS op_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cloud_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS op_queue_dead (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_id INTEGER NOT NULL,
  cloud_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  failed_at TEXT NOT NULL,
  last_error_code TEXT,
  last_error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_op_queue_dead_user_failed
  ON op_queue_dead(user_uid, failed_at DESC);

CREATE TABLE IF NOT EXISTS images (
  image_id TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  local_path TEXT NOT NULL,
  cloud_url TEXT,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message TEXT,
  last_message_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_updated
  ON chat_threads(user_uid, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
  ON chat_messages(user_uid, thread_id, created_at DESC);

PRAGMA user_version=11;
`,
  },
  {
    version: 2,
    up: `
DELETE FROM op_queue WHERE kind = 'persist_chat_message';
DELETE FROM op_queue_dead WHERE kind = 'persist_chat_message';
PRAGMA user_version=11;
`,
  },
  {
    version: 3,
    up: `
ALTER TABLE op_queue ADD COLUMN client_mutation_id TEXT NOT NULL DEFAULT '';
ALTER TABLE op_queue_dead ADD COLUMN client_mutation_id TEXT NOT NULL DEFAULT '';
UPDATE op_queue
SET client_mutation_id = 'legacy:' || user_uid || ':' || kind || ':' || cloud_id || ':' || updated_at
WHERE client_mutation_id IS NULL OR client_mutation_id = '';
UPDATE op_queue_dead
SET client_mutation_id = 'legacy:' || user_uid || ':' || kind || ':' || cloud_id || ':' || updated_at
WHERE client_mutation_id IS NULL OR client_mutation_id = '';
PRAGMA user_version=12;
`,
  },
];
