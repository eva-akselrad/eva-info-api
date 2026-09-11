import { Hono } from "hono";
import type { Env } from "../types";
import { renderRetiredPage } from "../lib/retired";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  const service = c.req.query("service") ?? undefined;
  const html = renderRetiredPage(service);

  return c.html(html, 410, {
    "Cache-Control": "public, max-age=3600",
  });
});

export default app;
