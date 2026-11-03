CREATE TABLE lab_achievements (
  code TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL
);
INSERT INTO lab_achievements VALUES ('first-verified-puzzle', '첫 검증 퍼즐 기록');

CREATE TABLE lab_user_achievements (
  user_id TEXT NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  code TEXT NOT NULL REFERENCES lab_achievements(code),
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (user_id,code)
);

CREATE TRIGGER lab_award_verified_puzzle
AFTER INSERT ON daily_puzzle_account_scores
WHEN NEW.revision LIKE '%:server-score-v1'
BEGIN
  INSERT OR IGNORE INTO lab_user_achievements VALUES (NEW.user_id,'first-verified-puzzle',NEW.achieved_at);
END;

INSERT INTO lab_user_achievements
SELECT user_id,'first-verified-puzzle',MIN(achieved_at)
FROM daily_puzzle_account_scores
WHERE revision LIKE '%:server-score-v1'
GROUP BY user_id;
