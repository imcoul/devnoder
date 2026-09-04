-- Templates Registry (Sprint 9)
-- Endpoints: GET /templates, POST /templates/publish
-- R2: template JSON stored at templates/{id}.json

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  tags TEXT,        -- JSON array
  commands TEXT,    -- JSON array
  download_url TEXT,
  downloads INTEGER DEFAULT 0,
  author TEXT,
  created_at INTEGER
);
