import { Hono } from "hono";
import type { Env } from "../types";
import { computeOverallStatus } from "../lib/checker";

const LABELS: Record<string, string> = {
  operational: "All systems operational",
  degraded: "Partial outage",
  outage: "Major outage",
};

const COLORS: Record<string, { bg: string; text: string }> = {
  operational: { bg: "#14532d", text: "#86efac" },
  degraded: { bg: "#78350f", text: "#fde68a" },
  outage: { bg: "#7f1d1d", text: "#fecaca" },
};

const app = new Hono<{ Bindings: Env }>();

app.get("/badge.svg", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT m.group_name, s.current_status
     FROM monitors m JOIN monitor_state s ON s.monitor_id = m.id`,
  ).all<{ group_name: string; current_status: string }>();

  const monitors = rows.results ?? [];
  const status = computeOverallStatus(monitors);
  const label = LABELS[status] ?? status;
  const colors = COLORS[status] ?? COLORS.operational;

  const width = Math.max(200, label.length * 7 + 40);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img" aria-label="${label}">
  <rect width="100%" height="100%" rx="6" fill="${colors.bg}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    fill="${colors.text}" font-family="system-ui,sans-serif" font-size="12" font-weight="600">${label}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
});

export default app;
