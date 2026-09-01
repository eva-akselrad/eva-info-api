CREATE TABLE monitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  url TEXT NOT NULL,
  check_type TEXT NOT NULL DEFAULT 'http' CHECK (check_type IN ('http', 'json_ok')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE monitor_state (
  monitor_id INTEGER PRIMARY KEY REFERENCES monitors(id),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  current_status TEXT NOT NULL DEFAULT 'unknown' CHECK (current_status IN ('up', 'down', 'unknown')),
  last_checked_at TEXT,
  last_latency_ms INTEGER,
  last_status_code INTEGER,
  last_error TEXT
);

CREATE TABLE checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id),
  ok INTEGER NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER,
  error TEXT,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_checks_monitor_checked ON checks(monitor_id, checked_at);

CREATE TABLE check_daily (
  monitor_id INTEGER NOT NULL REFERENCES monitors(id),
  day TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  ok_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (monitor_id, day)
);

CREATE TABLE incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  impact TEXT NOT NULL DEFAULT 'minor' CHECK (impact IN ('none', 'minor', 'major', 'critical')),
  auto INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE incident_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  body TEXT NOT NULL,
  status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE monitor_incidents (
  incident_id INTEGER NOT NULL REFERENCES incidents(id),
  monitor_id INTEGER NOT NULL REFERENCES monitors(id),
  PRIMARY KEY (incident_id, monitor_id)
);

CREATE TABLE registry (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  repo_url TEXT,
  docs_url TEXT,
  group_name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

INSERT INTO monitors (slug, name, group_name, url, check_type, sort_order) VALUES
  ('portfolio', 'evaakselrad.com', 'Portfolio', 'https://evaakselrad.com/api/health', 'http', 1),
  ('cardfest-api', 'CardFest API', 'Ticketing', 'https://api.evaakselrad.com/api/health', 'json_ok', 2),
  ('cardfest-site', 'CardFest Site', 'Ticketing', 'https://card.evaakselrad.com/', 'http', 3),
  ('cardfest-scanner', 'CardFest Scanner', 'Ticketing', 'https://scanner.evaakselrad.com/', 'http', 4),
  ('commuter', 'Commuter Dash', 'Tools', 'https://ah.evaakselrad.com/api/health', 'json_ok', 5),
  ('arcadiacs', 'arcadiacs.club', 'Client', 'https://arcadiacs.club/', 'http', 6);

INSERT INTO monitor_state (monitor_id, consecutive_failures, consecutive_successes, current_status)
SELECT id, 0, 0, 'unknown' FROM monitors;

INSERT INTO registry (slug, name, url, repo_url, group_name, description, sort_order) VALUES
  ('portfolio', 'Portfolio', 'https://evaakselrad.com', 'https://github.com/eva-akselrad/MyWebsite', 'Portfolio', 'Lighting design portfolio', 1),
  ('cardfest', 'CardFest Expo', 'https://card.evaakselrad.com', 'https://github.com/eva-akselrad/cardfest-expo-landing', 'Ticketing', 'Event ticketing platform (staging)', 2),
  ('commuter', 'Commuter Dash', 'https://ah.evaakselrad.com', NULL, 'Tools', 'Arcadia commuter assistant', 3),
  ('arcadiacs', 'Arcadia CS Club', 'https://arcadiacs.club', 'https://github.com/eva-akselrad/arcadiacsclub', 'Client', 'Arcadia University CS Club site', 4);
