-- Point Eva's Library monitor at the gateway /api/health endpoint (json_ok compatible)

UPDATE monitors
SET url = 'https://library.evaakselrad.com/api/health'
WHERE slug = 'evas-library';
