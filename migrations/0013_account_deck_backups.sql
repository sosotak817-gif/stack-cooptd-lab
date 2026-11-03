CREATE TABLE lab_deck_backups (
  deck_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_decks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TRIGGER lab_decks_keep_previous
BEFORE UPDATE OF name,data ON lab_decks
WHEN OLD.name <> NEW.name OR OLD.data <> NEW.data
BEGIN
  INSERT INTO lab_deck_backups(deck_id,name,data,revision,updated_at)
  VALUES(OLD.id,OLD.name,OLD.data,OLD.revision,OLD.updated_at)
  ON CONFLICT(deck_id) DO UPDATE SET
    name=excluded.name,
    data=excluded.data,
    revision=excluded.revision,
    updated_at=excluded.updated_at;
END;
