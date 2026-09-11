import { Hono } from "hono";
import type { Env } from "../types";
import { probeEvasLibrary } from "../lib/library-probe";

const app = new Hono<{ Bindings: Env }>();

/** Manual/debug probe — cron uses inline probeEvasLibrary() in checker.ts instead. */
app.get("/evas-library", async (c) => {
  const outcome = await probeEvasLibrary();
  const ok = outcome.ok;
  return c.json(
    {
      ok,
      status: ok ? "ok" : "offline",
      service: "evas-library",
      latencyMs: outcome.latencyMs,
      error: outcome.error,
    },
    ok ? 200 : 503,
  );
});

export default app;
