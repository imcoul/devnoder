-- Skills Registry (Sprint 13)
-- Endpoints: GET /skills, POST /skills, POST /skills/:id/rate

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  trigger TEXT,
  trigger_value TEXT,
  system_prompt_prefix TEXT,
  system_prompt_suffix TEXT,
  context_injectors TEXT,  -- JSON array
  author TEXT,
  downloads INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  created_at INTEGER
);
