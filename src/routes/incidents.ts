import { Hono } from "hono";
import type { Env } from "../types";
import { requireAdminOrScope, SCOPES } from "../lib/auth";
import { notifyIncidentOpened, notifyIncidentResolved } from "../lib/notifications";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const active = await c.env.DB.prepare(
    `SELECT i.id, i.title, i.status, i.impact, i.auto, i.created_at, i.resolved_at,
            (SELECT body FROM incident_updates WHERE incident_id = i.id ORDER BY created_at DESC LIMIT 1) as latest_update,
            (SELECT created_at FROM incident_updates WHERE incident_id = i.id ORDER BY created_at DESC LIMIT 1) as latest_update_at
     FROM incidents i
     WHERE i.resolved_at IS NULL
     ORDER BY i.created_at DESC`,
  ).all();

  const resolved = await c.env.DB.prepare(
    `SELECT id, title, status, impact, auto, created_at, resolved_at
     FROM incidents WHERE resolved_at IS NOT NULL ORDER BY resolved_at DESC LIMIT 20`,
  ).all();

  const activeWithMonitors = (active.results ?? []).map(async (row) => {
    const monitors = await c.env.DB.prepare(
      `SELECT m.slug, m.name FROM monitor_incidents mi
       JOIN monitors m ON m.id = mi.monitor_id WHERE mi.incident_id = ?`,
    )
      .bind(row.id as number)
      .all();
    return { ...row, monitors: monitors.results ?? [] };
  });

  return c.json({
    active: await Promise.all(activeWithMonitors),
    resolved: resolved.results ?? [],
  });
});

app.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const incident = await c.env.DB.prepare(
    `SELECT id, title, status, impact, auto, created_at, resolved_at FROM incidents WHERE id = ?`,
  )
    .bind(id)
    .first();

  if (!incident) return c.json({ error: "Incident not found" }, 404);

  const updates = await c.env.DB.prepare(
    `SELECT id, body, status, created_at FROM incident_updates WHERE incident_id = ? ORDER BY created_at`,
  )
    .bind(id)
    .all();

  const monitors = await c.env.DB.prepare(
    `SELECT m.slug, m.name FROM monitor_incidents mi JOIN monitors m ON m.id = mi.monitor_id WHERE mi.incident_id = ?`,
  )
    .bind(id)
    .all();

  return c.json({ incident, updates: updates.results ?? [], monitors: monitors.results ?? [] });
});

app.post("/", async (c) => {
  if (!(await requireAdminOrScope(c, SCOPES.STATUS_WRITE))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{
    title?: string;
    body?: string;
    impact?: string;
    monitorSlugs?: string[];
  }>();

  if (!body.title?.trim()) return c.json({ error: "title is required" }, 400);

  const result = await c.env.DB.prepare(
    `INSERT INTO incidents (title, status, impact, auto) VALUES (?, 'investigating', ?, 0)`,
  )
    .bind(body.title.trim(), body.impact ?? "minor")
    .run();

  const incidentId = Number(result.meta.last_row_id);
  const updateBody = body.body?.trim();

  if (updateBody) {
    await c.env.DB.prepare(
      `INSERT INTO incident_updates (incident_id, body, status) VALUES (?, ?, 'investigating')`,
    )
      .bind(incidentId, updateBody)
      .run();
  }

  if (body.monitorSlugs?.length) {
    for (const slug of body.monitorSlugs) {
      const monitor = await c.env.DB.prepare(`SELECT id FROM monitors WHERE slug = ?`)
        .bind(slug)
        .first<{ id: number }>();
      if (monitor) {
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO monitor_incidents (incident_id, monitor_id) VALUES (?, ?)`,
        )
          .bind(incidentId, monitor.id)
          .run();
      }
    }
  }

  try {
    await notifyIncidentOpened(c.env, {
      id: incidentId,
      title: body.title.trim(),
      body: updateBody,
    });
  } catch (err) {
    console.error("Incident notify failed", err);
  }

  return c.json({ id: incidentId }, 201);
});

app.patch("/:id", async (c) => {
  if (!(await requireAdminOrScope(c, SCOPES.STATUS_WRITE))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ body?: string; status?: string; resolve?: boolean }>();

  const incident = await c.env.DB.prepare(
    `SELECT id, title FROM incidents WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: number; title: string }>();

  if (!incident) return c.json({ error: "Incident not found" }, 404);

  if (body.resolve) {
    await c.env.DB.prepare(
      `UPDATE incidents SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?`,
    )
      .bind(id)
      .run();
  } else if (body.status) {
    await c.env.DB.prepare(`UPDATE incidents SET status = ? WHERE id = ?`)
      .bind(body.status, id)
      .run();
  }

  const updateBody = body.body?.trim();
  if (updateBody) {
    await c.env.DB.prepare(
      `INSERT INTO incident_updates (incident_id, body, status) VALUES (?, ?, ?)`,
    )
      .bind(id, updateBody, body.status ?? null)
      .run();
  }

  if (body.resolve) {
    try {
      await notifyIncidentResolved(c.env, {
        id: incident.id,
        title: incident.title,
        body: updateBody ?? "This incident has been resolved.",
      });
    } catch (err) {
      console.error("Resolve notify failed", err);
    }
  }

  return c.json({ ok: true });
});

export default app;
