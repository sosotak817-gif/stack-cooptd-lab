CREATE TABLE IF NOT EXISTS rankings (
  revision TEXT NOT NULL,
  deck TEXT NOT NULL CHECK (deck IN ('clara', 'goblin')),
  target TEXT NOT NULL,
  owner TEXT NOT NULL,
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  score REAL NOT NULL CHECK (score > 0 AND score <= 1e100),
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (revision, deck, target, owner)
);
CREATE INDEX IF NOT EXISTS ranking_order
  ON rankings(revision, deck, target, score DESC, achieved_at ASC, owner ASC);
CREATE TABLE IF NOT EXISTS ranking_limits (
  key TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  count INTEGER NOT NULL,
  next_at INTEGER NOT NULL
);
