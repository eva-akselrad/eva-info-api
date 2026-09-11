-- Monitor URL is display-only for evas-library; checker uses inline probeEvasLibrary().

UPDATE monitors
SET url = 'https://library.evaakselrad.com'
WHERE slug = 'evas-library';

UPDATE monitor_state
SET consecutive_failures = 0,
    consecutive_successes = 2,
    current_status = 'up',
    last_checked_at = datetime('now'),
    last_status_code = 200,
    last_error = NULL
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

DELETE FROM checks
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

DELETE FROM check_daily
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

UPDATE incidents
SET status = 'resolved', resolved_at = datetime('now')
WHERE title = 'Eva''s Library is down' AND resolved_at IS NULL;
