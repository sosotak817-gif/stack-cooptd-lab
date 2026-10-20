CREATE TABLE IF NOT EXISTS lab_vaults (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lab_vault_expiry ON lab_vaults(expires_at);
CREATE TABLE IF NOT EXISTS lab_vault_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
