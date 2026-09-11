export const RETIRED_PAGE_URL = "https://status.evaakselrad.com/retired";

export function retiredServiceUrl(serviceName: string): string {
  return `${RETIRED_PAGE_URL}?service=${encodeURIComponent(serviceName)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderRetiredPage(serviceName?: string): string {
  const name = serviceName?.trim();
  const heading = name ? `${escapeHtml(name)} has been retired` : "This service has been retired";
  const lead = name
    ? `${escapeHtml(name)} is no longer available. It was shut down permanently and will not return.`
    : "This service is no longer available. It was shut down permanently and will not return.";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading} — Eva Akselrad</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --bg: #f4f5f7;
      --surface: #ffffff;
      --border: #dde1e8;
      --text: #0f1419;
      --text-secondary: #4b5568;
      --text-muted: #7a8499;
      --accent: #1d4ed8;
      --accent-hover: #1e40af;
      --radius-lg: 12px;
      --shadow-md: 0 4px 12px rgba(15, 20, 25, 0.08);
      --font: "IBM Plex Sans", system-ui, -apple-system, sans-serif;
    }
    html { -webkit-font-smoothing: antialiased; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      font-family: var(--font);
      font-size: 15px;
      line-height: 1.5;
      color: var(--text);
      background: var(--bg);
    }
    .site-header {
      padding: 1.25rem 1.5rem;
      background: var(--surface);
      border-bottom: 1px solid #eaecf0;
    }
    .site-brand {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text);
      text-decoration: none;
    }
    main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      padding: 2rem;
      text-align: center;
    }
    .icon {
      width: 3rem;
      height: 3rem;
      margin: 0 auto 1.25rem;
      border-radius: 50%;
      background: #f3f4f6;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      line-height: 1;
    }
    h1 {
      margin: 0 0 0.75rem;
      font-size: 1.375rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    p {
      margin: 0 0 1.75rem;
      color: var(--text-secondary);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.625rem 1.125rem;
      border-radius: 8px;
      font: inherit;
      font-size: 0.9375rem;
      font-weight: 500;
      text-decoration: none;
      border: 1px solid transparent;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .btn-primary {
      background: var(--accent);
      color: #fff;
    }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary {
      background: var(--surface);
      color: var(--text);
      border-color: var(--border);
    }
    .btn-secondary:hover {
      background: #f9fafb;
      border-color: #c5cad3;
    }
    footer {
      padding: 1.25rem 1.5rem;
      text-align: center;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="site-brand" href="https://evaakselrad.com">Eva Akselrad</a>
  </header>
  <main>
    <div class="card">
      <div class="icon" aria-hidden="true">↪</div>
      <h1>${heading}</h1>
      <p>${lead}</p>
      <div class="actions">
        <a class="btn btn-primary" href="https://evaakselrad.com">Visit evaakselrad.com</a>
        <a class="btn btn-secondary" href="https://status.evaakselrad.com">View system status</a>
      </div>
    </div>
  </main>
  <footer>Service no longer monitored or maintained.</footer>
</body>
</html>`;
}
