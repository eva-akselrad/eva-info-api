PRAGMA foreign_keys = OFF;

CREATE TABLE monitor_state_new (
  monitor_id INTEGER PRIMARY KEY REFERENCES monitors(id),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  current_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (current_status IN ('up', 'down', 'unknown', 'maintenance')),
  manual_pc_offline INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  last_latency_ms INTEGER,
  last_status_code INTEGER,
  last_error TEXT
);

INSERT INTO monitor_state_new (
  monitor_id,
  consecutive_failures,
  consecutive_successes,
  current_status,
  manual_pc_offline,
  last_checked_at,
  last_latency_ms,
  last_status_code,
  last_error
)
SELECT
  monitor_id,
  consecutive_failures,
  consecutive_successes,
  current_status,
  0,
  last_checked_at,
  last_latency_ms,
  last_status_code,
  last_error
FROM monitor_state;

DROP TABLE monitor_state;
ALTER TABLE monitor_state_new RENAME TO monitor_state;

PRAGMA foreign_keys = ON;
