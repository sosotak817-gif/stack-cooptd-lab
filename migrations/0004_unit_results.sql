CREATE TABLE IF NOT EXISTS lab_unit_results (
  owner TEXT NOT NULL,
  revision TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  result TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner, revision, cache_key)
);
CREATE INDEX IF NOT EXISTS lab_unit_results_age ON lab_unit_results(updated_at);
