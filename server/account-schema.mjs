// Account D1 bootstrap from migrations 0002, 0006 and 0009–0018.
export const accountSchema = [
  "CREATE TABLE IF NOT EXISTS lab_users (\n  id TEXT PRIMARY KEY,\n  naver_id TEXT NOT NULL UNIQUE,\n  nickname TEXT NOT NULL,\n  created_at INTEGER NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS lab_sessions (\n  token_hash TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  csrf TEXT NOT NULL,\n  expires_at INTEGER NOT NULL\n);",
  "CREATE INDEX IF NOT EXISTS lab_sessions_expiry ON lab_sessions(expires_at);",
  "CREATE TABLE IF NOT EXISTS lab_boards (\n  user_id TEXT PRIMARY KEY REFERENCES lab_users(id) ON DELETE CASCADE,\n  data TEXT NOT NULL,\n  revision INTEGER NOT NULL DEFAULT 1,\n  updated_at INTEGER NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS deck_guides (\n  id TEXT PRIMARY KEY,\n  owner TEXT NOT NULL,\n  nickname TEXT NOT NULL,\n  title TEXT NOT NULL,\n  mode TEXT NOT NULL,\n  wave INTEGER NOT NULL,\n  summary TEXT NOT NULL,\n  units TEXT NOT NULL,\n  guide TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n);",
  "CREATE INDEX IF NOT EXISTS deck_guides_recent ON deck_guides(created_at DESC, id DESC);",
  "CREATE INDEX IF NOT EXISTS deck_guides_mode_recent ON deck_guides(mode, created_at DESC, id DESC);",
  "CREATE INDEX IF NOT EXISTS deck_guides_owner_recent ON deck_guides(owner, created_at DESC);",
  "CREATE TABLE IF NOT EXISTS lab_pin_credentials (\n  user_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  nickname_normalized TEXT NOT NULL UNIQUE,\n  pin_hash TEXT NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS lab_recovery_devices (\n  id TEXT PRIMARY KEY NOT NULL,\n  user_id TEXT NOT NULL REFERENCES lab_pin_credentials(user_id) ON DELETE CASCADE,\n  name TEXT NOT NULL,\n  token_hash TEXT NOT NULL UNIQUE,\n  created_at INTEGER NOT NULL,\n  expires_at INTEGER NOT NULL,\n  last_used_at INTEGER,\n  revoked_at INTEGER\n);",
  "CREATE INDEX IF NOT EXISTS lab_recovery_devices_user_id ON lab_recovery_devices(user_id);",
  "CREATE TABLE IF NOT EXISTS lab_auth_attempts (\n  scope TEXT NOT NULL,\n  key_hash TEXT NOT NULL,\n  window_start INTEGER NOT NULL,\n  attempts INTEGER NOT NULL CHECK (attempts > 0),\n  PRIMARY KEY (scope, key_hash, window_start)\n);",
  "CREATE INDEX IF NOT EXISTS lab_auth_attempts_window_start ON lab_auth_attempts(window_start);",
  "CREATE TABLE IF NOT EXISTS lab_board_backups (\n  user_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  data TEXT NOT NULL,\n  revision INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n);",
  "CREATE TRIGGER IF NOT EXISTS lab_boards_keep_previous\nBEFORE UPDATE OF data ON lab_boards\nWHEN OLD.data <> NEW.data\nBEGIN\n  INSERT INTO lab_board_backups(user_id,data,revision,updated_at)\n  VALUES(OLD.user_id,OLD.data,OLD.revision,OLD.updated_at)\n  ON CONFLICT(user_id) DO UPDATE SET\n    data=excluded.data,\n    revision=excluded.revision,\n    updated_at=excluded.updated_at;\nEND;",
  "CREATE TABLE IF NOT EXISTS lab_decks (\n  id TEXT PRIMARY KEY NOT NULL,\n  user_id TEXT NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  name TEXT NOT NULL,\n  data TEXT NOT NULL,\n  revision INTEGER NOT NULL DEFAULT 1,\n  created_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n);",
  "CREATE INDEX IF NOT EXISTS lab_decks_owner ON lab_decks(user_id,updated_at DESC);",
  "CREATE TABLE IF NOT EXISTS lab_settings (\n  user_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  data TEXT NOT NULL,\n  revision INTEGER NOT NULL DEFAULT 1,\n  updated_at INTEGER NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS lab_deck_backups (\n  deck_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_decks(id) ON DELETE CASCADE,\n  name TEXT NOT NULL,\n  data TEXT NOT NULL,\n  revision INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n);",
  "CREATE TRIGGER IF NOT EXISTS lab_decks_keep_previous\nBEFORE UPDATE OF name,data ON lab_decks\nWHEN OLD.name <> NEW.name OR OLD.data <> NEW.data\nBEGIN\n  INSERT INTO lab_deck_backups(deck_id,name,data,revision,updated_at)\n  VALUES(OLD.id,OLD.name,OLD.data,OLD.revision,OLD.updated_at)\n  ON CONFLICT(deck_id) DO UPDATE SET\n    name=excluded.name,\n    data=excluded.data,\n    revision=excluded.revision,\n    updated_at=excluded.updated_at;\nEND;",
  "CREATE TABLE IF NOT EXISTS daily_puzzle_account_scores (\n  week INTEGER NOT NULL,\n  revision TEXT NOT NULL,\n  user_id TEXT NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  score REAL NOT NULL,\n  moves INTEGER NOT NULL,\n  achieved_at INTEGER NOT NULL,\n  replay TEXT NOT NULL,\n  PRIMARY KEY (week, revision, user_id)\n);",
  "CREATE INDEX IF NOT EXISTS daily_puzzle_account_rank\n  ON daily_puzzle_account_scores (week, revision, score DESC, moves, achieved_at, user_id);",
  "CREATE TABLE IF NOT EXISTS lab_analysis_records (\n  id TEXT PRIMARY KEY NOT NULL,\n  user_id TEXT NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  tool TEXT NOT NULL,\n  title TEXT NOT NULL,\n  summary TEXT NOT NULL,\n  created_at INTEGER NOT NULL\n);",
  "CREATE INDEX IF NOT EXISTS lab_analysis_owner ON lab_analysis_records(user_id,created_at DESC);",
  "CREATE TABLE IF NOT EXISTS lab_progress (\n  user_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  data TEXT NOT NULL,\n  revision INTEGER NOT NULL DEFAULT 1\n);",
  "CREATE TABLE IF NOT EXISTS lab_achievements (\n  code TEXT PRIMARY KEY NOT NULL,\n  title TEXT NOT NULL\n);",
  "INSERT OR IGNORE INTO lab_achievements VALUES ('first-verified-puzzle', '첫 검증 퍼즐 기록');",
  "CREATE TABLE IF NOT EXISTS lab_user_achievements (\n  user_id TEXT NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,\n  code TEXT NOT NULL REFERENCES lab_achievements(code),\n  earned_at INTEGER NOT NULL,\n  PRIMARY KEY (user_id,code)\n);",
  "CREATE TRIGGER IF NOT EXISTS lab_award_verified_puzzle\nAFTER INSERT ON daily_puzzle_account_scores\nWHEN NEW.revision LIKE '%:server-score-v1'\nBEGIN\n  INSERT OR IGNORE INTO lab_user_achievements VALUES (NEW.user_id,'first-verified-puzzle',NEW.achieved_at);\nEND;",
  "INSERT OR IGNORE INTO lab_user_achievements\nSELECT user_id,'first-verified-puzzle',MIN(achieved_at)\nFROM daily_puzzle_account_scores\nWHERE revision LIKE '%:server-score-v1'\nGROUP BY user_id;",
  "CREATE TABLE IF NOT EXISTS lab_featured_badges (\n user_id TEXT PRIMARY KEY NOT NULL,\n code TEXT NOT NULL,\n FOREIGN KEY (user_id,code) REFERENCES lab_user_achievements(user_id,code) ON DELETE CASCADE\n);"
];

export const researchAchievementSchema = [
  "INSERT OR IGNORE INTO lab_achievements VALUES ('first-deck','첫 덱 저장'),('first-guide','첫 덱 공략 발행');",
  "CREATE TRIGGER IF NOT EXISTS lab_award_first_deck\nAFTER INSERT ON lab_decks\nBEGIN\n INSERT OR IGNORE INTO lab_user_achievements VALUES (NEW.user_id,'first-deck',NEW.created_at);\nEND;",
  "CREATE TRIGGER IF NOT EXISTS lab_award_first_guide\nAFTER INSERT ON deck_guides\nWHEN NEW.owner LIKE 'account:%'\nBEGIN\n INSERT OR IGNORE INTO lab_user_achievements\n SELECT id,'first-guide',NEW.created_at FROM lab_users WHERE id=substr(NEW.owner,9);\nEND;",
  "INSERT OR IGNORE INTO lab_user_achievements\nSELECT user_id,'first-deck',MIN(created_at) FROM lab_decks GROUP BY user_id;",
  "INSERT OR IGNORE INTO lab_user_achievements\nSELECT u.id,'first-guide',MIN(g.created_at) FROM lab_users u JOIN deck_guides g ON g.owner='account:'||u.id GROUP BY u.id;"
];

export const weeklyAchievementSchema = [
  "INSERT OR IGNORE INTO lab_achievements VALUES ('first-weekly-challenge','첫 주간 덱 챌린지');",
  "CREATE TRIGGER IF NOT EXISTS lab_award_first_weekly_challenge\nAFTER INSERT ON daily_puzzle_account_scores\nWHEN NEW.revision LIKE '%:weekly:server-score-v1'\nBEGIN\n INSERT OR IGNORE INTO lab_user_achievements VALUES (NEW.user_id,'first-weekly-challenge',NEW.achieved_at);\nEND;",
  "INSERT OR IGNORE INTO lab_user_achievements\nSELECT user_id,'first-weekly-challenge',MIN(achieved_at)\nFROM daily_puzzle_account_scores WHERE revision LIKE '%:weekly:server-score-v1' GROUP BY user_id;"
];

export const hiddenStackSchema = [
  "INSERT OR IGNORE INTO lab_achievements VALUES ('hidden-stack','스택');",
  "CREATE TRIGGER IF NOT EXISTS lab_award_hidden_stack\nAFTER INSERT ON lab_pin_credentials\nWHEN NEW.nickname_normalized='스택'\nBEGIN\n INSERT OR IGNORE INTO lab_user_achievements\n SELECT id,'hidden-stack',created_at FROM lab_users WHERE id=NEW.user_id AND nickname='스택';\nEND;",
  "INSERT OR IGNORE INTO lab_user_achievements\nSELECT u.id,'hidden-stack',u.created_at FROM lab_users u\nJOIN lab_pin_credentials c ON c.user_id=u.id\nWHERE u.nickname='스택' AND c.nickname_normalized='스택';"
];
