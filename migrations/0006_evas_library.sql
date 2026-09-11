-- Eva's Library — media library UI (Sonarr/Radarr) at library.evaakselrad.com

INSERT INTO monitors (slug, name, group_name, url, check_type, sort_order) VALUES
  ('evas-library', 'Eva''s Library', 'Library', 'https://library.evaakselrad.com/api/ping', 'json_ok', 0);

INSERT INTO monitor_state (monitor_id, consecutive_failures, consecutive_successes, current_status)
SELECT id, 0, 0, 'unknown' FROM monitors WHERE slug = 'evas-library';

INSERT INTO registry (slug, name, url, repo_url, group_name, description, sort_order) VALUES
  (
    'evas-library',
    'Eva''s Library',
    'https://library.evaakselrad.com',
    'https://github.com/eva-akselrad/sonarr-simple-ui',
    'Library',
    'Personal media library — browse and add TV shows & movies via Sonarr/Radarr',
    0
  );
