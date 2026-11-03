CREATE TABLE IF NOT EXISTS daily_puzzle_scores (
  week INTEGER NOT NULL,
  revision TEXT NOT NULL,
  nickname_key TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score REAL NOT NULL,
  moves INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (week, revision, nickname_key)
);
CREATE INDEX IF NOT EXISTS daily_puzzle_leaderboard
  ON daily_puzzle_scores (week, revision, score DESC, moves, achieved_at, nickname_key);
