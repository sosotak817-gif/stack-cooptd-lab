CREATE TABLE IF NOT EXISTS gem_tier_votes (voter TEXT PRIMARY KEY, ballot TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lab_vote_migrations (id TEXT PRIMARY KEY);
DELETE FROM gem_tier_votes WHERE NOT EXISTS (SELECT 1 FROM lab_vote_migrations WHERE id='2026-11-04-gem-login-reset');
INSERT OR IGNORE INTO lab_vote_migrations VALUES ('2026-11-04-gem-login-reset');
