CREATE TABLE IF NOT EXISTS lab_feature_access (
 id TEXT PRIMARY KEY,
 logged_in INTEGER NOT NULL,
 guest INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_feature_access_meta (
 id INTEGER PRIMARY KEY CHECK(id=1),
 revision INTEGER NOT NULL,
 token TEXT NOT NULL
);
INSERT OR IGNORE INTO lab_feature_access_meta VALUES (1,0,'');
