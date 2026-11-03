CREATE TABLE lab_board_backups (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TRIGGER lab_boards_keep_previous
BEFORE UPDATE OF data ON lab_boards
WHEN OLD.data <> NEW.data
BEGIN
  INSERT INTO lab_board_backups(user_id,data,revision,updated_at)
  VALUES(OLD.user_id,OLD.data,OLD.revision,OLD.updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    data=excluded.data,
    revision=excluded.revision,
    updated_at=excluded.updated_at;
END;
