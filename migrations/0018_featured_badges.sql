CREATE TABLE lab_featured_badges (
 user_id TEXT PRIMARY KEY NOT NULL,
 code TEXT NOT NULL,
 FOREIGN KEY (user_id,code) REFERENCES lab_user_achievements(user_id,code) ON DELETE CASCADE
);
