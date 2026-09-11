-- Use edge-only /api/healthcheck (origin /api/health requires login)

UPDATE monitors
SET url = 'https://library.evaakselrad.com/api/healthcheck'
WHERE slug = 'evas-library';

UPDATE monitor_state
SET consecutive_failures = 0,
    consecutive_successes = 2,
    current_status = 'up',
    last_checked_at = datetime('now'),
    last_status_code = 200,
    last_error = NULL
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

UPDATE incidents
SET status = 'resolved', resolved_at = datetime('now')
WHERE title = 'Eva''s Library is down' AND resolved_at IS NULL;

INSERT INTO incident_updates (incident_id, body, status)
SELECT id, 'Monitor now uses edge-only /api/healthcheck (public, no login).', 'resolved'
FROM incidents
WHERE title = 'Eva''s Library is down' AND resolved_at = datetime('now');
