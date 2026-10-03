-- Yjs document persistence for collab (Sprint 4)
CREATE TABLE documents (
  room_id TEXT PRIMARY KEY,
  state BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);
