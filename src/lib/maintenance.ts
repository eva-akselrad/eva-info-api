import type { Env } from "../types";

export async function isMonitorInMaintenance(env: Env, monitorId: number): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 FROM maintenance_window_monitors mwm
     JOIN maintenance_windows mw ON mw.id = mwm.window_id
     WHERE mwm.monitor_id = ?
       AND datetime('now') >= mw.starts_at
       AND datetime('now') <= mw.ends_at
     LIMIT 1`,
  )
    .bind(monitorId)
    .first();

  return Boolean(row);
}

export async function listActiveMaintenance(env: Env) {
  return env.DB.prepare(
    `SELECT mw.id, mw.title, mw.starts_at, mw.ends_at,
            GROUP_CONCAT(m.slug) as monitor_slugs
     FROM maintenance_windows mw
     JOIN maintenance_window_monitors mwm ON mwm.window_id = mw.id
     JOIN monitors m ON m.id = mwm.monitor_id
     WHERE datetime('now') <= mw.ends_at
     GROUP BY mw.id
     ORDER BY mw.starts_at DESC`,
  ).all();
}

export async function createMaintenanceWindow(
  env: Env,
  opts: { title: string; monitorSlugs: string[]; durationMinutes: number },
): Promise<number> {
  const result = await env.DB.prepare(
    `INSERT INTO maintenance_windows (title, starts_at, ends_at)
     VALUES (?, datetime('now'), datetime('now', '+' || ? || ' minutes'))`,
  )
    .bind(opts.title, opts.durationMinutes)
    .run();

  const windowId = Number(result.meta.last_row_id);

  for (const slug of opts.monitorSlugs) {
    const monitor = await env.DB.prepare(`SELECT id FROM monitors WHERE slug = ?`)
      .bind(slug)
      .first<{ id: number }>();
    if (monitor) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO maintenance_window_monitors (window_id, monitor_id) VALUES (?, ?)`,
      )
        .bind(windowId, monitor.id)
        .run();
    }
  }

  return windowId;
}
