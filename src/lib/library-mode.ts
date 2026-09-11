import type { Env } from "../types";

async function getEvasLibraryMonitorId(env: Env): Promise<number | null> {
  const row = await env.DB.prepare(`SELECT id FROM monitors WHERE slug = 'evas-library'`)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export async function isEvasLibraryManuallyOffline(env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT s.manual_pc_offline
     FROM monitors m
     JOIN monitor_state s ON s.monitor_id = m.id
     WHERE m.slug = 'evas-library'`,
  ).first<{ manual_pc_offline: number }>();

  return row?.manual_pc_offline === 1;
}

async function resolveAutoIncident(env: Env, monitorId: number): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT i.id, i.title FROM incidents i
     JOIN monitor_incidents mi ON mi.incident_id = i.id
     WHERE mi.monitor_id = ? AND i.auto = 1 AND i.resolved_at IS NULL
     ORDER BY i.created_at DESC LIMIT 1`,
  )
    .bind(monitorId)
    .first<{ id: number; title: string }>();

  if (!row) return;

  await env.DB.prepare(
    `UPDATE incidents SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?`,
  )
    .bind(row.id)
    .run();

  await env.DB.prepare(
    `INSERT INTO incident_updates (incident_id, body, status) VALUES (?, ?, 'resolved')`,
  )
    .bind(row.id, "Service marked as planned PC downtime.")
    .run();
}

export async function setEvasLibraryMode(
  env: Env,
  mode: "online" | "pc_offline",
): Promise<{ monitorId: number; mode: "online" | "pc_offline" }> {
  const monitorId = await getEvasLibraryMonitorId(env);
  if (!monitorId) throw new Error("Eva's Library monitor not found");

  if (mode === "pc_offline") {
    await env.DB.prepare(
      `UPDATE monitor_state SET
         manual_pc_offline = 1,
         current_status = 'maintenance',
         consecutive_failures = 0,
         consecutive_successes = 0,
         last_checked_at = datetime('now'),
         last_error = NULL
       WHERE monitor_id = ?`,
    )
      .bind(monitorId)
      .run();

    await resolveAutoIncident(env, monitorId);
  } else {
    await env.DB.prepare(
      `UPDATE monitor_state SET
         manual_pc_offline = 0,
         consecutive_failures = 0,
         consecutive_successes = 0,
         current_status = 'unknown',
         last_checked_at = datetime('now'),
         last_error = NULL
       WHERE monitor_id = ?`,
    )
      .bind(monitorId)
      .run();
  }

  return { monitorId, mode };
}
