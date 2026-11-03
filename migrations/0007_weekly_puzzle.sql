CREATE TABLE IF NOT EXISTS weekly_puzzle_scores (
  week INTEGER NOT NULL,
  revision TEXT NOT NULL,
  owner TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score REAL NOT NULL,
  moves INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (week, revision, owner)
);
CREATE INDEX IF NOT EXISTS weekly_puzzle_leaderboard
  ON weekly_puzzle_scores (week, revision, score DESC, moves, achieved_at, owner);
