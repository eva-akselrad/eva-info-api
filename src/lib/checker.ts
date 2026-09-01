import type { CheckType, Env, MonitorRow, OverallStatus } from "../types";
import { isMonitorInMaintenance } from "./maintenance";
import { notifyIncidentOpened, notifyIncidentResolved } from "./notifications";

const FAIL_THRESHOLD = 3;
const RESOLVE_THRESHOLD = 2;
const CHECK_TIMEOUT_MS = 15000;

interface CheckOutcome {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}

async function runSingleCheck(url: string, checkType: CheckType): Promise<CheckOutcome> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { "User-Agent": "eva-info-api-monitor/1.0" },
    });
    const latencyMs = Date.now() - start;

    if (checkType === "http") {
      const ok = res.status >= 200 && res.status < 400;
      return {
        ok,
        statusCode: res.status,
        latencyMs,
        error: ok ? null : `HTTP ${res.status}`,
      };
    }

    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        statusCode: res.status,
        latencyMs,
        error: "Invalid JSON response",
      };
    }

    const jsonOk =
      parsed?.ok === true ||
      parsed?.status === "ok" ||
      (parsed?.db === true && parsed?.ok !== false);

    const ok = res.ok && jsonOk;
    return {
      ok,
      statusCode: res.status,
      latencyMs,
      error: ok ? null : `Health check failed (${res.status})`,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Check failed",
    };
  }
}

async function openAutoIncident(env: Env, monitor: MonitorRow): Promise<void> {
  const title = `${monitor.name} is down`;
  const result = await env.DB.prepare(
    `INSERT INTO incidents (title, status, impact, auto) VALUES (?, 'investigating', 'major', 1)`,
  )
    .bind(title)
    .run();

  const incidentId = Number(result.meta.last_row_id);
  await env.DB.prepare(
    `INSERT INTO incident_updates (incident_id, body, status) VALUES (?, ?, 'investigating')`,
  )
    .bind(incidentId, `Automated alert: ${monitor.name} failed ${FAIL_THRESHOLD} consecutive checks.`)
    .run();

  await env.DB.prepare(
    `INSERT INTO monitor_incidents (incident_id, monitor_id) VALUES (?, ?)`,
  )
    .bind(incidentId, monitor.id)
    .run();

  try {
    await notifyIncidentOpened(env, {
      id: incidentId,
      title,
      body: `Automated alert: ${monitor.name} failed ${FAIL_THRESHOLD} consecutive checks.`,
    });
  } catch (err) {
    console.error("Failed to send incident email", err);
  }
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

  const resolveBody = "Service recovered — auto-resolved after successful checks.";
  await env.DB.prepare(
    `INSERT INTO incident_updates (incident_id, body, status) VALUES (?, ?, 'resolved')`,
  )
    .bind(row.id, resolveBody)
    .run();

  try {
    await notifyIncidentResolved(env, { id: row.id, title: row.title, body: resolveBody });
  } catch (err) {
    console.error("Failed to send resolve notification", err);
  }
}

async function rollupDaily(env: Env, monitorId: number, day: string): Promise<void> {
  const stats = await env.DB.prepare(
    `SELECT COUNT(*) as total, SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) as ok_count,
            AVG(latency_ms) as avg_latency
     FROM checks WHERE monitor_id = ? AND checked_at >= ? AND checked_at < date(?, '+1 day')`,
  )
    .bind(monitorId, day, day)
    .first<{ total: number; ok_count: number; avg_latency: number | null }>();

  if (!stats || stats.total === 0) return;

  await env.DB.prepare(
    `INSERT INTO check_daily (monitor_id, day, total, ok_count, avg_latency_ms)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(monitor_id, day) DO UPDATE SET
       total = excluded.total,
       ok_count = excluded.ok_count,
       avg_latency_ms = excluded.avg_latency_ms`,
  )
    .bind(monitorId, day, stats.total, stats.ok_count, Math.round(stats.avg_latency ?? 0))
    .run();
}

async function pruneOldChecks(env: Env): Promise<void> {
  await env.DB.prepare(`DELETE FROM checks WHERE checked_at < datetime('now', '-90 days')`).run();
}

export async function runAllChecks(env: Env): Promise<void> {
  const monitors = await env.DB.prepare(
    `SELECT id, slug, name, group_name, url, check_type, sort_order FROM monitors ORDER BY sort_order`,
  ).all<MonitorRow>();

  const today = new Date().toISOString().slice(0, 10);

  for (const monitor of monitors.results ?? []) {
    const outcome = await runSingleCheck(monitor.url, monitor.check_type);

    await env.DB.prepare(
      `INSERT INTO checks (monitor_id, ok, status_code, latency_ms, error) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(monitor.id, outcome.ok ? 1 : 0, outcome.statusCode, outcome.latencyMs, outcome.error)
      .run();

    const state = await env.DB.prepare(
      `SELECT consecutive_failures, consecutive_successes FROM monitor_state WHERE monitor_id = ?`,
    )
      .bind(monitor.id)
      .first<{ consecutive_failures: number; consecutive_successes: number }>();

    let failures = state?.consecutive_failures ?? 0;
    let successes = state?.consecutive_successes ?? 0;

    if (outcome.ok) {
      successes += 1;
      failures = 0;
    } else {
      failures += 1;
      successes = 0;
    }

    const currentStatus = outcome.ok ? "up" : failures >= FAIL_THRESHOLD ? "down" : "unknown";

    await env.DB.prepare(
      `UPDATE monitor_state SET
         consecutive_failures = ?,
         consecutive_successes = ?,
         current_status = ?,
         last_checked_at = datetime('now'),
         last_latency_ms = ?,
         last_status_code = ?,
         last_error = ?
       WHERE monitor_id = ?`,
    )
      .bind(
        failures,
        successes,
        currentStatus,
        outcome.latencyMs,
        outcome.statusCode,
        outcome.error,
        monitor.id,
      )
      .run();

    if (failures === FAIL_THRESHOLD) {
      const inMaintenance = await isMonitorInMaintenance(env, monitor.id);
      if (!inMaintenance) {
        const existing = await env.DB.prepare(
          `SELECT i.id FROM incidents i
           JOIN monitor_incidents mi ON mi.incident_id = i.id
           WHERE mi.monitor_id = ? AND i.auto = 1 AND i.resolved_at IS NULL`,
        )
          .bind(monitor.id)
          .first();

        if (!existing) await openAutoIncident(env, monitor);
      }
    }

    if (successes === RESOLVE_THRESHOLD && outcome.ok) {
      await resolveAutoIncident(env, monitor.id);
    }

    await rollupDaily(env, monitor.id, today);
  }

  await pruneOldChecks(env);
}

export function computeOverallStatus(
  monitors: Array<{ current_status: string; group_name: string }>,
): OverallStatus {
  if (monitors.length === 0) return "operational";

  const down = monitors.filter((m) => m.current_status === "down");
  if (down.length === 0) return "operational";

  const groups = [...new Set(monitors.map((m) => m.group_name))];
  const allGroupsDown = groups.some((group) => {
    const inGroup = monitors.filter((m) => m.group_name === group);
    return inGroup.length > 0 && inGroup.every((m) => m.current_status === "down");
  });

  return allGroupsDown ? "outage" : "degraded";
}

export async function getUptimePercent(env: Env, monitorId: number, days: number): Promise<number> {
  const daily = await env.DB.prepare(
    `SELECT SUM(total) as total, SUM(ok_count) as ok_count FROM check_daily
     WHERE monitor_id = ? AND day >= date('now', '-' || ? || ' days')`,
  )
    .bind(monitorId, days)
    .first<{ total: number; ok_count: number }>();

  if (!daily?.total) {
    const live = await env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) as ok_count
       FROM checks WHERE monitor_id = ? AND checked_at >= datetime('now', '-' || ? || ' days')`,
    )
      .bind(monitorId, days)
      .first<{ total: number; ok_count: number }>();

    if (!live?.total) return 100;
    return Math.round((live.ok_count / live.total) * 10000) / 100;
  }

  return Math.round((daily.ok_count / daily.total) * 10000) / 100;
}
