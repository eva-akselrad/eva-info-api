import type { Env } from "../types";
import { computeOverallStatus } from "./checker";
import { notifyOps } from "./notifications";

export async function sendDailyDigest(env: Env): Promise<void> {
  const monitors = await env.DB.prepare(
    `SELECT m.slug, m.name, m.group_name, m.url, s.current_status, s.last_error
     FROM monitors m JOIN monitor_state s ON s.monitor_id = m.id
     ORDER BY m.sort_order`,
  ).all<{
    slug: string;
    name: string;
    group_name: string;
    url: string;
    current_status: string;
    last_error: string | null;
  }>();

  const rows = monitors.results ?? [];
  const overall = computeOverallStatus(
    rows.map((m) => ({ group_name: m.group_name, current_status: m.current_status })),
  );

  const activeIncidents = await env.DB.prepare(
    `SELECT title, status, impact, created_at FROM incidents WHERE resolved_at IS NULL ORDER BY created_at DESC`,
  ).all<{ title: string; status: string; impact: string; created_at: string }>();

  const down = rows.filter((m) => m.current_status === "down");
  const degraded = rows.filter((m) => m.current_status !== "up" && m.current_status !== "down");

  const lines: string[] = [
    `Overall: ${overall}`,
    `Monitors: ${rows.filter((m) => m.current_status === "up").length}/${rows.length} up`,
    "",
  ];

  if (down.length) {
    lines.push("DOWN:");
    for (const m of down) {
      lines.push(`  - ${m.name} (${m.slug}): ${m.last_error ?? "unknown"}`);
    }
    lines.push("");
  }

  if (activeIncidents.results?.length) {
    lines.push("ACTIVE INCIDENTS:");
    for (const inc of activeIncidents.results) {
      lines.push(`  - ${inc.title} [${inc.impact}] (${inc.status})`);
    }
    lines.push("");
  }

  if (!down.length && !activeIncidents.results?.length) {
    lines.push("All monitored services are operational. No open incidents.");
  }

  const htmlRows = rows
    .map((m) => {
      const color = m.current_status === "up" ? "#22c55e" : m.current_status === "down" ? "#ef4444" : "#f59e0b";
      return `<tr><td>${m.name}</td><td style="color:${color}">${m.current_status}</td></tr>`;
    })
    .join("");

  const html = `
    <h2>Daily status digest</h2>
    <p><strong>Overall:</strong> ${overall}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      <tr><th>Service</th><th>Status</th></tr>
      ${htmlRows}
    </table>
    <p><a href="https://status.evaakselrad.com">Open status page</a></p>
  `;

  await notifyOps(env, `[Status] Daily digest — ${overall}`, lines.join("\n"), html);

  const digestSubs = await env.DB.prepare(
    `SELECT email, unsubscribe_token FROM subscribers WHERE verified = 1 AND digest = 1`,
  ).all<{ email: string; unsubscribe_token: string }>();

  for (const sub of digestSubs.results ?? []) {
    try {
      await env.EMAIL.send({
        to: sub.email,
        from: { email: env.FROM_EMAIL, name: "Eva Akselrad Status" },
        subject: `[Status] Daily digest — ${overall}`,
        text: lines.join("\n"),
        html,
      });
    } catch (err) {
      console.error("Digest to subscriber failed", sub.email, err);
    }
  }
}
