-- Retire Eva's Library — removed from status monitoring

DELETE FROM monitor_incidents
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

DELETE FROM maintenance_window_monitors
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

DELETE FROM check_daily
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

DELETE FROM checks
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

DELETE FROM monitor_state
WHERE monitor_id = (SELECT id FROM monitors WHERE slug = 'evas-library');

DELETE FROM monitors WHERE slug = 'evas-library';

DELETE FROM registry WHERE slug = 'evas-library';
