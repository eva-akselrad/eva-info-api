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
  const monitor = await c.env.DB.prepare(`SELECT id FROM monitors WHERE slug = ?`)
    .bind(slug)
    .first<{ id: number }>();

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

  return c.json({
    slug,
    uptime: { days7: uptime7, days30: uptime30, days90: uptime90 },
    recentChecks: recent.results ?? [],
  });
});

export default app;
