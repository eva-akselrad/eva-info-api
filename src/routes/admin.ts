import { Hono } from "hono";
import type { Env } from "../types";
import { createApiKey, requireAdmin, requireAdminOrScope, SCOPES } from "../lib/auth";
import { createMaintenanceWindow, listActiveMaintenance } from "../lib/maintenance";

const app = new Hono<{ Bindings: Env }>();

app.get("/maintenance", async (c) => {
  if (!(await requireAdminOrScope(c, SCOPES.STATUS_WRITE))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const rows = await listActiveMaintenance(c.env);
  return c.json({ windows: rows.results ?? [] });
});

app.post("/maintenance", async (c) => {
  if (!(await requireAdminOrScope(c, SCOPES.STATUS_WRITE))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{
    title?: string;
    monitorSlugs?: string[];
    durationMinutes?: number;
  }>();

  if (!body.title?.trim()) return c.json({ error: "title is required" }, 400);
  if (!body.monitorSlugs?.length) return c.json({ error: "monitorSlugs required" }, 400);

  const duration = Math.min(Math.max(body.durationMinutes ?? 30, 5), 240);

  const id = await createMaintenanceWindow(c.env, {
    title: body.title.trim(),
    monitorSlugs: body.monitorSlugs,
    durationMinutes: duration,
  });

  return c.json({ id, durationMinutes: duration }, 201);
});

app.get("/keys", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
  const rows = await c.env.DB.prepare(
    `SELECT id, name, scopes, created_at FROM api_keys ORDER BY created_at DESC`,
  ).all();
  return c.json({ keys: rows.results ?? [] });
});

app.post("/keys", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{ name?: string; scopes?: string[] }>();
  if (!body.name?.trim()) return c.json({ error: "name is required" }, 400);

  const scopes = body.scopes ?? [SCOPES.STATUS_READ];
  const allowed: string[] = [SCOPES.STATUS_READ, SCOPES.STATUS_WRITE, SCOPES.ADMIN];
  if (!scopes.every((s) => allowed.includes(s))) {
    return c.json({ error: "Invalid scopes" }, 400);
  }

  const key = await createApiKey(c.env, body.name.trim(), scopes);
  return c.json({ key, name: body.name.trim(), scopes }, 201);
});

export default app;
