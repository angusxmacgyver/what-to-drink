CREATE TABLE IF NOT EXISTS bottles (
  id TEXT PRIMARY KEY,
  bottle_key TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bottles_bottle_key ON bottles (bottle_key);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
