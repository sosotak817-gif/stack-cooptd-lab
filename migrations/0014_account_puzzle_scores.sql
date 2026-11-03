CREATE TABLE daily_puzzle_account_scores (
  week INTEGER NOT NULL,
  revision TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  moves INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  replay TEXT NOT NULL,
  PRIMARY KEY (week, revision, user_id)
);
CREATE INDEX daily_puzzle_account_rank
  ON daily_puzzle_account_scores (week, revision, score DESC, moves, achieved_at, user_id);
