-- Label Eva-account CardFest monitors as staging
UPDATE monitors SET
  name = 'CardFest API',
  group_name = 'CardFest (staging)',
  sort_order = 11
WHERE slug = 'cardfest-api';

UPDATE monitors SET
  name = 'CardFest Site',
  group_name = 'CardFest (staging)',
  sort_order = 12
WHERE slug = 'cardfest-site';

UPDATE monitors SET
  name = 'CardFest Scanner',
  group_name = 'CardFest (staging)',
  sort_order = 13
WHERE slug = 'cardfest-scanner';

-- CardFest production (Ross account — cardfestexpo.com)
INSERT INTO monitors (slug, name, group_name, url, check_type, sort_order) VALUES
  ('cardfest-prod-api', 'CardFest API', 'CardFest (production)', 'https://api.cardfestexpo.com/api/health', 'json_ok', 21),
  ('cardfest-prod-site', 'cardfestexpo.com', 'CardFest (production)', 'https://cardfestexpo.com/', 'http', 22),
  ('cardfest-prod-scanner', 'CardFest Scanner', 'CardFest (production)', 'https://scanner.cardfestexpo.com/', 'http', 23);

INSERT INTO monitor_state (monitor_id, consecutive_failures, consecutive_successes, current_status)
SELECT id, 0, 0, 'unknown' FROM monitors
WHERE slug IN ('cardfest-prod-api', 'cardfest-prod-site', 'cardfest-prod-scanner');

-- Ownstage
INSERT INTO monitors (slug, name, group_name, url, check_type, sort_order) VALUES
  ('ownstage-site', 'ownstage.app', 'Ownstage', 'https://ownstage.app/', 'http', 31),
  ('ownstage-demo', 'Ownstage Demo Checkout', 'Ownstage', 'https://demo.ownstage.app/', 'http', 32),
  ('ownstage-api', 'Ownstage API', 'Ownstage', 'https://api-demo.ownstage.app/api/health', 'json_ok', 33),
  ('ownstage-scanner', 'Ownstage Scanner', 'Ownstage', 'https://scanner.ownstage.app/', 'http', 34);

INSERT INTO monitor_state (monitor_id, consecutive_failures, consecutive_successes, current_status)
SELECT id, 0, 0, 'unknown' FROM monitors
WHERE slug IN ('ownstage-site', 'ownstage-demo', 'ownstage-api', 'ownstage-scanner');

UPDATE registry SET
  name = 'CardFest Expo (staging)',
  group_name = 'CardFest (staging)',
  description = 'Event ticketing platform — Eva staging (evaakselrad.com)'
WHERE slug = 'cardfest';

INSERT INTO registry (slug, name, url, repo_url, group_name, description, sort_order) VALUES
  (
    'cardfest-prod',
    'CardFest Expo',
    'https://cardfestexpo.com',
    'https://github.com/eva-akselrad/cardfest-expo-landing',
    'CardFest (production)',
    'Event ticketing platform — production (Ross account)',
    5
  ),
  (
    'ownstage',
    'Ownstage',
    'https://ownstage.app',
    'https://github.com/eva-akselrad/Ownstage',
    'Ownstage',
    'White-label event ticketing demo platform',
    6
  );
