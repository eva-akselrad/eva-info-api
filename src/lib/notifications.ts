import type { Env } from "../types";

const STATUS_BASE = "https://status.evaakselrad.com";

function from(env: Env) {
  return { email: env.FROM_EMAIL, name: "Eva Akselrad Status" };
}

export async function notifyOps(env: Env, subject: string, text: string, html?: string): Promise<void> {
  if (!env.OPS_NOTIFY_EMAIL) return;
  await env.EMAIL.send({
    to: env.OPS_NOTIFY_EMAIL,
    from: from(env),
    subject,
    text,
    html: html ?? text,
  });
}

export async function notifyVerifiedSubscribers(
  env: Env,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT email, unsubscribe_token FROM subscribers WHERE verified = 1`,
  ).all<{ email: string; unsubscribe_token: string }>();

  for (const sub of rows.results ?? []) {
    const unsub = `${STATUS_BASE}/api/v1/subscribe/unsubscribe?token=${sub.unsubscribe_token}`;
    try {
      await env.EMAIL.send({
        to: sub.email,
        from: from(env),
        subject,
        text: `${text}\n\nUnsubscribe: ${unsub}`,
        html: `${html}<p style="margin-top:24px;font-size:12px;color:#666"><a href="${unsub}">Unsubscribe</a> from status updates.</p>`,
      });
    } catch (err) {
      console.error("Subscriber notify failed", sub.email, err);
    }
  }
}

export async function notifyIncidentOpened(
  env: Env,
  incident: { id: number; title: string; body?: string },
): Promise<void> {
  const url = `${STATUS_BASE}/`;
  const subject = `[Status] New incident: ${incident.title}`;
  const text = `${incident.title}\n\n${incident.body ?? ""}\n\nView: ${url}`;
  const html = `
    <h2>${incident.title}</h2>
    <p>${incident.body ?? "A new incident has been opened."}</p>
    <p><a href="${url}">View status page</a></p>
  `;

  await notifyOps(env, subject, text, html);
  await notifyVerifiedSubscribers(env, subject, text, html);
}

export async function notifyIncidentResolved(
  env: Env,
  incident: { id: number; title: string; body?: string },
): Promise<void> {
  const url = `${STATUS_BASE}/`;
  const subject = `[Status] Resolved: ${incident.title}`;
  const text = `${incident.title} has been resolved.\n\n${incident.body ?? ""}\n\nView: ${url}`;
  const html = `
    <h2>Resolved: ${incident.title}</h2>
    <p>${incident.body ?? "This incident has been resolved."}</p>
    <p><a href="${url}">View status page</a></p>
  `;

  await notifyOps(env, subject, text, html);
  await notifyVerifiedSubscribers(env, subject, text, html);
}
