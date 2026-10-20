CREATE TABLE IF NOT EXISTS lab_users (
  id TEXT PRIMARY KEY,
  naver_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lab_sessions_expiry ON lab_sessions(expires_at);
CREATE TABLE IF NOT EXISTS lab_boards (
  user_id TEXT PRIMARY KEY REFERENCES lab_users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
