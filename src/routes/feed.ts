import type { Env } from "../types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function feedXml(env: Env): Promise<Response> {
  const incidents = await env.DB.prepare(
    `SELECT i.id, i.title, i.status, i.impact, i.created_at, i.resolved_at,
            (SELECT body FROM incident_updates WHERE incident_id = i.id ORDER BY created_at LIMIT 1) as first_update
     FROM incidents i ORDER BY i.created_at DESC LIMIT 50`,
  ).all<{
    id: number;
    title: string;
    status: string;
    impact: string;
    created_at: string;
    resolved_at: string | null;
    first_update: string | null;
  }>();

  const base = "https://status.evaakselrad.com";
  const entries = (incidents.results ?? [])
    .map((inc) => {
      const updated = inc.resolved_at ?? inc.created_at;
      const summary = inc.first_update ?? inc.title;
      return `
  <entry>
    <title>${escapeXml(inc.title)}</title>
    <link href="${base}/#/incidents/${inc.id}" />
    <id>${base}/incidents/${inc.id}</id>
    <updated>${updated}</updated>
    <published>${inc.created_at}</published>
    <summary>${escapeXml(summary)}</summary>
    <category term="${inc.status}" />
  </entry>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Eva Akselrad Status</title>
  <link href="${base}/feed.xml" rel="self" />
  <link href="${base}/" />
  <updated>${new Date().toISOString()}</updated>
  <id>${base}/</id>${entries}
</feed>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}
