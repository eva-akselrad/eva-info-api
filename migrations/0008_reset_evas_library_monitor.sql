-- Reset Eva's Library monitor state after switching to /api/health

UPDATE monitor_state
SET consecutive_failures = 0,
    consecutive_successes = 2,
    current_status = 'up',
    last_checked_at = datetime('now'),
    last_error = NULL
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');
