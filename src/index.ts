import { Hono } from "hono";
import type { Env } from "./types";
import statusRoutes from "./routes/status";
import incidentsRoutes from "./routes/incidents";
import registryRoutes from "./routes/registry";
import contactRoutes from "./routes/contact";
import clientRoutes from "./routes/client";
import { feedXml } from "./routes/feed";
import { runAllChecks } from "./lib/checker";
import { requireAdmin } from "./lib/auth";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal server error" }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true, service: "eva-info-api", status: "ok" }));
app.get("/feed.xml", (c) => feedXml(c.env));

app.post("/api/v1/admin/run-checks", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Unauthorized" }, 401);
  await runAllChecks(c.env);
  return c.json({ ok: true });
});

app.route("/api/v1/status", statusRoutes);
app.route("/api/v1/incidents", incidentsRoutes);
app.route("/api/v1/registry", registryRoutes);
app.route("/api/v1/contact", contactRoutes);
app.route("/api/v1/client", clientRoutes);

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runAllChecks(env));
  },
};
