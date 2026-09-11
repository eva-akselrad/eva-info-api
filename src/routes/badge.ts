import { Hono } from "hono";
import type { Env } from "../types";
import { computeOverallStatus } from "../lib/checker";

const LABELS: Record<string, string> = {
  operational: "All systems operational",
  degraded: "Partial disruption",
  outage: "Major outage",
};

const DOT_COLORS: Record<string, string> = {
  operational: "#22c55e",
  degraded: "#f59e0b",
  outage: "#ef4444",
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
  const dot = DOT_COLORS[status] ?? DOT_COLORS.operational;

  const textWidth = label.length * 6.5;
  const width = Math.ceil(16 + 10 + 8 + textWidth + 12);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="24" role="img" aria-label="${label}">
  <rect width="100%" height="100%" rx="4" fill="#141414" stroke="#2a2a2a" stroke-width="1"/>
  <circle cx="12" cy="12" r="4" fill="${dot}"/>
  <text x="24" y="12" dominant-baseline="middle"
    fill="#d4d4d4" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="500">${label}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
});

export default app;
