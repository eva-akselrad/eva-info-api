-- Is He Dead Yet? — celebrity status tracker at ishedeadyet.evaakselrad.com

INSERT INTO monitors (slug, name, group_name, url, check_type, sort_order) VALUES
  ('ishedeadyet', 'Is He Dead Yet?', 'Projects', 'https://ishedeadyet.evaakselrad.com/', 'http', 7);

INSERT INTO monitor_state (monitor_id, consecutive_failures, consecutive_successes, current_status)
SELECT id, 0, 0, 'unknown' FROM monitors WHERE slug = 'ishedeadyet';

INSERT INTO registry (slug, name, url, repo_url, group_name, description, sort_order) VALUES
  (
    'ishedeadyet',
    'Is He Dead Yet?',
    'https://ishedeadyet.evaakselrad.com',
    NULL,
    'Projects',
    'Lighthearted celebrity status tracker',
    7
  );
