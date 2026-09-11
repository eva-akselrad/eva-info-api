-- Retire Commuter Dash (ah.evaakselrad.com) — hackathon project shut down

DELETE FROM monitor_incidents
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'commuter');

DELETE FROM maintenance_window_monitors
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'commuter');

DELETE FROM check_daily
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'commuter');

DELETE FROM checks
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'commuter');

DELETE FROM monitor_state
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'commuter');

DELETE FROM monitors WHERE slug = 'commuter';

DELETE FROM registry WHERE slug = 'commuter';

UPDATE incidents
SET status = 'resolved', resolved_at = datetime('now')
WHERE title = 'Commuter Dash permanent removal' AND resolved_at IS NULL;

INSERT INTO incident_updates (incident_id, body, status)
SELECT id,
  'Commuter Dash has been permanently shut down. ah.evaakselrad.com now redirects to evaakselrad.com.',
  'resolved'
FROM incidents
WHERE title = 'Commuter Dash permanent removal';
