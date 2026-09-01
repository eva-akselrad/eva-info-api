import { Hono } from "hono";
import type { Env } from "../types";
import { checkRateLimit } from "../lib/email";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const allowed = await checkRateLimit(c.env.DB, `client:${ip}`, 60, 60);
  if (!allowed) return c.json({ error: "Rate limit exceeded" }, 429);

  return c.json({
    ip: c.req.header("CF-Connecting-IP"),
    country: c.req.header("CF-IPCountry"),
    colo: c.req.header("CF-Ray")?.split("-").pop(),
    city: c.req.header("CF-IPCity"),
    region: c.req.header("CF-IPRegion"),
    timezone: c.req.header("CF-Timezone"),
    asn: c.req.header("CF-ASN"),
    userAgent: c.req.header("User-Agent"),
    ray: c.req.header("CF-Ray"),
  });
});

export default app;
