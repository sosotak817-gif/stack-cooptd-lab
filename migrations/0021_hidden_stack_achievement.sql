INSERT OR IGNORE INTO lab_achievements VALUES ('hidden-stack','스택');
CREATE TRIGGER IF NOT EXISTS lab_award_hidden_stack
AFTER INSERT ON lab_pin_credentials
WHEN NEW.nickname_normalized='스택'
BEGIN
 INSERT OR IGNORE INTO lab_user_achievements
 SELECT id,'hidden-stack',created_at FROM lab_users WHERE id=NEW.user_id AND nickname='스택';
END;
INSERT OR IGNORE INTO lab_user_achievements
SELECT u.id,'hidden-stack',u.created_at FROM lab_users u
JOIN lab_pin_credentials c ON c.user_id=u.id
WHERE u.nickname='스택' AND c.nickname_normalized='스택';
