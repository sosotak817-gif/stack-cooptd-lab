INSERT OR IGNORE INTO lab_achievements VALUES ('first-deck','첫 덱 저장'),('first-guide','첫 덱 공략 발행');
CREATE TRIGGER IF NOT EXISTS lab_award_first_deck
AFTER INSERT ON lab_decks
BEGIN
 INSERT OR IGNORE INTO lab_user_achievements VALUES (NEW.user_id,'first-deck',NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS lab_award_first_guide
AFTER INSERT ON deck_guides
WHEN NEW.owner LIKE 'account:%'
BEGIN
 INSERT OR IGNORE INTO lab_user_achievements
 SELECT id,'first-guide',NEW.created_at FROM lab_users WHERE id=substr(NEW.owner,9);
END;
INSERT OR IGNORE INTO lab_user_achievements
SELECT user_id,'first-deck',MIN(created_at) FROM lab_decks GROUP BY user_id;
INSERT OR IGNORE INTO lab_user_achievements
SELECT u.id,'first-guide',MIN(g.created_at) FROM lab_users u JOIN deck_guides g ON g.owner='account:'||u.id GROUP BY u.id;
