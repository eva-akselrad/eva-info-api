import { Hono } from "hono";
import type { Env } from "../types";
import { checkRateLimit } from "../lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS_BASE = "https://status.evaakselrad.com";

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const allowed = await checkRateLimit(c.env.DB, `subscribe:${ip}`, 5, 3600);
  if (!allowed) return c.json({ error: "Too many requests. Please try again later." }, 429);

  const body = await c.req.json<{ email?: string; digest?: boolean }>().catch(() => ({} as { email?: string; digest?: boolean }));
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ error: "Please provide a valid email address." }, 400);
  }

  const verifyToken = crypto.randomUUID();
  const unsubscribeToken = crypto.randomUUID();
  const digest = body.digest ? 1 : 0;

  const existing = await c.env.DB.prepare(`SELECT id, verified FROM subscribers WHERE email = ?`)
    .bind(email)
    .first<{ id: number; verified: number }>();

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE subscribers SET verify_token = ?, digest = ?, verified = 0 WHERE id = ?`,
    )
      .bind(verifyToken, digest, existing.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO subscribers (email, verified, verify_token, unsubscribe_token, digest) VALUES (?, 0, ?, ?, ?)`,
    )
      .bind(email, verifyToken, unsubscribeToken, digest)
      .run();
  }

  const verifyUrl = `${STATUS_BASE}/api/v1/subscribe/verify?token=${verifyToken}`;

  try {
    await c.env.EMAIL.send({
      to: email,
      from: { email: c.env.FROM_EMAIL, name: "Eva Akselrad Status" },
      subject: "Confirm your status page subscription",
      text: `Confirm your subscription to Eva Akselrad status updates:\n\n${verifyUrl}\n\nIf you did not request this, ignore this email.`,
      html: `
        <p>Confirm your subscription to status updates for evaakselrad.com services.</p>
        <p><a href="${verifyUrl}">Confirm subscription</a></p>
      `,
    });
  } catch (err) {
    console.error("Verify email failed", err);
    return c.json({ error: "Failed to send confirmation email." }, 500);
  }

  return c.json({
    success: true,
    message: "Check your email to confirm your subscription.",
  });
});

app.get("/verify", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return c.text("Missing token.", 400);

  const row = await c.env.DB.prepare(`SELECT id FROM subscribers WHERE verify_token = ?`)
    .bind(token)
    .first();

  if (!row) return c.text("Invalid or expired verification link.", 404);

  await c.env.DB.prepare(`UPDATE subscribers SET verified = 1 WHERE id = ?`)
    .bind(row.id as number)
    .run();

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Subscribed</title>
    <style>body{font-family:system-ui;background:#0a0a0a;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{border:1px solid #333;padding:2rem;border-radius:12px;max-width:420px;text-align:center}
    a{color:#7dd3fc}</style></head><body><div class="box">
    <h1>You're subscribed</h1>
    <p>You'll receive emails when incidents open or resolve.</p>
    <p><a href="${STATUS_BASE}/">View status page</a></p>
    </div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
});

app.get("/unsubscribe", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!token) return c.text("Missing token.", 400);

  const result = await c.env.DB.prepare(`DELETE FROM subscribers WHERE unsubscribe_token = ?`)
    .bind(token)
    .run();

  if (!result.meta.changes) return c.text("Invalid unsubscribe link.", 404);

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
    <style>body{font-family:system-ui;background:#0a0a0a;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{border:1px solid #333;padding:2rem;border-radius:12px;max-width:420px;text-align:center}
    a{color:#7dd3fc}</style></head><body><div class="box">
    <h1>Unsubscribed</h1>
    <p>You won't receive further status emails from this list.</p>
    <p><a href="${STATUS_BASE}/">View status page</a></p>
    </div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
});

export default app;
