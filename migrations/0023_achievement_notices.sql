CREATE TABLE IF NOT EXISTS lab_achievement_notices (
 user_id TEXT NOT NULL,
 code TEXT NOT NULL,
 PRIMARY KEY(user_id,code),
 FOREIGN KEY(user_id,code) REFERENCES lab_user_achievements(user_id,code) ON DELETE CASCADE
);
CREATE TRIGGER IF NOT EXISTS lab_queue_achievement_notice
AFTER INSERT ON lab_user_achievements
BEGIN
 INSERT OR IGNORE INTO lab_achievement_notices VALUES (NEW.user_id,NEW.code);
END;
