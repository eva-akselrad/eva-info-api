import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT slug, name, url, repo_url, docs_url, group_name, description, sort_order
     FROM registry ORDER BY sort_order`,
  ).all();

  return c.json({ projects: rows.results ?? [] });
});

export default app;
