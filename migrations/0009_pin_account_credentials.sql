CREATE TABLE lab_pin_credentials (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  nickname_normalized TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL
);

CREATE TABLE lab_recovery_devices (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES lab_pin_credentials(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX lab_recovery_devices_user_id ON lab_recovery_devices(user_id);

CREATE TABLE lab_auth_attempts (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (scope, key_hash, window_start)
);
CREATE INDEX lab_auth_attempts_window_start ON lab_auth_attempts(window_start);
