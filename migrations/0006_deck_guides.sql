CREATE TABLE IF NOT EXISTS deck_guides (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  nickname TEXT NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL,
  wave INTEGER NOT NULL,
  summary TEXT NOT NULL,
  units TEXT NOT NULL,
  guide TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS deck_guides_recent ON deck_guides(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS deck_guides_mode_recent ON deck_guides(mode, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS deck_guides_owner_recent ON deck_guides(owner, created_at DESC);
