import { Hono } from "hono";
import type { Env } from "../types";
import { computeOverallStatus, getUptimePercent } from "../lib/checker";

const app = new Hono<{ Bindings: Env }>();

app.get("/status", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT m.group_name, s.current_status
     FROM monitors m JOIN monitor_state s ON s.monitor_id = m.id`,
  ).all<{ group_name: string; current_status: string }>();

  const monitors = rows.results ?? [];
  const up = monitors.filter((m) => m.current_status === "up").length;
  const down = monitors.filter((m) => m.current_status === "down").length;

  return c.json({
    status: computeOverallStatus(monitors),
    summary: { total: monitors.length, up, down },
    updatedAt: new Date().toISOString(),
  });
});

app.get("/services", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.slug, m.name, m.group_name, m.url, m.check_type, m.sort_order,
            s.current_status, s.last_checked_at, s.last_latency_ms, s.last_status_code, s.last_error
     FROM monitors m JOIN monitor_state s ON s.monitor_id = m.id
     ORDER BY m.sort_order`,
  ).all();

  const services = (rows.results ?? []).map(async (row) => ({
    slug: row.slug as string,
    name: row.name as string,
    group: row.group_name as string,
    url: row.url as string,
    status: row.current_status as string,
    lastCheckedAt: row.last_checked_at as string | null,
    latencyMs: row.last_latency_ms as number | null,
    statusCode: row.last_status_code as number | null,
    error: row.last_error as string | null,
    uptime90d: await getUptimePercent(c.env, row.id as number, 90),
  }));

  return c.json({ services: await Promise.all(services) });
});

app.get("/services/:slug/history", async (c) => {
  const slug = c.req.param("slug");
  const monitor = await c.env.DB.prepare(
    `SELECT id, slug, name, group_name, url, check_type FROM monitors WHERE slug = ?`,
  )
    .bind(slug)
    .first<{ id: number; slug: string; name: string; group_name: string; url: string; check_type: string }>();

  if (!monitor) return c.json({ error: "Service not found" }, 404);

  const days = Number(c.req.query("days") ?? 90);
  const clamped = Math.min(Math.max(days, 1), 90);

  const uptime7 = await getUptimePercent(c.env, monitor.id, 7);
  const uptime30 = await getUptimePercent(c.env, monitor.id, 30);
  const uptime90 = await getUptimePercent(c.env, monitor.id, clamped);

  const recent = await c.env.DB.prepare(
    `SELECT ok, status_code, latency_ms, error, checked_at
     FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 100`,
  )
    .bind(monitor.id)
    .all();

  const state = await c.env.DB.prepare(
    `SELECT current_status, last_checked_at, last_latency_ms, last_status_code, last_error
     FROM monitor_state WHERE monitor_id = ?`,
  )
    .bind(monitor.id)
    .first();

  const incidents = await c.env.DB.prepare(
    `SELECT i.id, i.title, i.status, i.impact, i.auto, i.created_at, i.resolved_at
     FROM incidents i
     JOIN monitor_incidents mi ON mi.incident_id = i.id
     WHERE mi.monitor_id = ?
     ORDER BY i.created_at DESC
     LIMIT 30`,
  )
    .bind(monitor.id)
    .all();

  const daily = await c.env.DB.prepare(
    `SELECT day, total, ok_count, avg_latency_ms FROM check_daily
     WHERE monitor_id = ? AND day >= date('now', '-90 days')
     ORDER BY day`,
  )
    .bind(monitor.id)
    .all();

  return c.json({
    service: {
      slug: monitor.slug,
      name: monitor.name,
      group: monitor.group_name,
      url: monitor.url,
      checkType: monitor.check_type,
      status: state?.current_status ?? "unknown",
      lastCheckedAt: state?.last_checked_at ?? null,
      latencyMs: state?.last_latency_ms ?? null,
      statusCode: state?.last_status_code ?? null,
      error: state?.last_error ?? null,
    },
    uptime: { days7: uptime7, days30: uptime30, days90: uptime90 },
    daily: daily.results ?? [],
    recentChecks: recent.results ?? [],
    incidents: incidents.results ?? [],
  });
});

export default app;
