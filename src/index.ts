import { Hono } from "hono";
import type { Env } from "./types";
import statusRoutes from "./routes/status";
import incidentsRoutes from "./routes/incidents";
import registryRoutes from "./routes/registry";
import contactRoutes from "./routes/contact";
import clientRoutes from "./routes/client";
import subscribeRoutes from "./routes/subscribe";
import badgeRoutes from "./routes/badge";
import adminRoutes from "./routes/admin";
import { feedXml } from "./routes/feed";
import { runAllChecks } from "./lib/checker";
import { sendDailyDigest } from "./lib/digest";
import { requireAdminOrScope, SCOPES } from "./lib/auth";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal server error" }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true, service: "eva-info-api", status: "ok" }));
app.get("/feed.xml", (c) => feedXml(c.env));

app.post("/api/v1/admin/run-checks", async (c) => {
  if (!(await requireAdminOrScope(c, SCOPES.ADMIN))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await runAllChecks(c.env);
  return c.json({ ok: true });
});

app.route("/api/v1/status", statusRoutes);
app.route("/api/v1", badgeRoutes);
app.route("/api/v1/incidents", incidentsRoutes);
app.route("/api/v1/registry", registryRoutes);
app.route("/api/v1/contact", contactRoutes);
app.route("/api/v1/client", clientRoutes);
app.route("/api/v1/subscribe", subscribeRoutes);
app.route("/api/v1/admin", adminRoutes);

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    if (event.cron === "*/3 * * * *") {
      ctx.waitUntil(runAllChecks(env));
    }
    if (event.cron === "0 12 * * *") {
      ctx.waitUntil(sendDailyDigest(env));
    }
  },
};
