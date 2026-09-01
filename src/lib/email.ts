import type { Env } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeHeaderValue(str: string): string {
  return str.replace(/[\r\n]/g, "");
}

export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row) {
    await db
      .prepare("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)")
      .bind(key, now)
      .run();
    return true;
  }

  if (now - row.window_start >= windowSeconds) {
    await db
      .prepare("UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?")
      .bind(now, key)
      .run();
    return true;
  }

  if (row.count >= limit) return false;

  await db
    .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
    .bind(key)
    .run();
  return true;
}

export async function sendContactEmail(
  env: Env,
  opts: {
    to: string;
    fromEmail: string;
    fromName: string;
    subjectPrefix: string;
    name: string;
    email: string;
    message: string;
  },
): Promise<void> {
  const safeName = escapeHtml(opts.name);
  const safeEmail = escapeHtml(opts.email);
  const safeMessage = escapeHtml(opts.message).replace(/\n/g, "<br>");
  const headerName = sanitizeHeaderValue(opts.name);
  const headerEmail = sanitizeHeaderValue(opts.email);

  await env.EMAIL.send({
    to: opts.to,
    from: { email: opts.fromEmail, name: opts.fromName },
    replyTo: { email: headerEmail, name: headerName },
    subject: `${opts.subjectPrefix}: ${headerName}`,
    html: `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
    `,
    text: `New contact form submission\n\nName: ${opts.name}\nEmail: ${opts.email}\n\nMessage:\n${opts.message}`,
  });
}

export function validateContactFields(name: string, email: string, message: string): string | null {
  if (!name || !email || !message) return "Name, email, and message are required.";
  if (!EMAIL_RE.test(email)) return "Please provide a valid email address.";
  if (name.length > 200 || email.length > 254 || message.length > 5000) {
    return "One or more fields exceed the maximum length.";
  }
  return null;
}
