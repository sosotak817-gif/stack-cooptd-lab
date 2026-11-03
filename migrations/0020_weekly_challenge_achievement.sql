INSERT OR IGNORE INTO lab_achievements VALUES ('first-weekly-challenge','첫 주간 덱 챌린지');
CREATE TRIGGER IF NOT EXISTS lab_award_first_weekly_challenge
AFTER INSERT ON daily_puzzle_account_scores
WHEN NEW.revision LIKE '%:weekly:server-score-v1'
BEGIN
 INSERT OR IGNORE INTO lab_user_achievements VALUES (NEW.user_id,'first-weekly-challenge',NEW.achieved_at);
END;
INSERT OR IGNORE INTO lab_user_achievements
SELECT user_id,'first-weekly-challenge',MIN(achieved_at)
FROM daily_puzzle_account_scores WHERE revision LIKE '%:weekly:server-score-v1' GROUP BY user_id;
