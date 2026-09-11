-- Fix portfolio monitor: site has no /api/health (static assets + contact only).
-- Checking /api/health returned 404 and falsely marked evaakselrad.com as down.
UPDATE monitors
SET url = 'https://evaakselrad.com/'
WHERE slug = 'portfolio' AND url LIKE '%/api/health';
