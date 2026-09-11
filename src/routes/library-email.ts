import { Hono } from "hono";
import type { Env } from "../types";
import { escapeHtml, sanitizeHeaderValue } from "../lib/email";
import { requireAdmin } from "../lib/auth";

type Template = "credentials" | "password-reset" | "otp";

interface LibraryEmailBody {
  to?: string;
  template?: Template;
  username?: string;
  password?: string;
  resetUrl?: string;
  appUrl?: string;
}

function buildEmail(
  template: Template,
  opts: { username: string; password?: string; resetUrl?: string; appUrl?: string },
): { subject: string; html: string; text: string } {
  const safeUsername = escapeHtml(opts.username);
  const appName = "Eva's Library";
  const appUrl = opts.appUrl || "https://library.evaakselrad.com";

  if (template === "credentials") {
    const safePassword = escapeHtml(opts.password || "");
    return {
      subject: `Your ${appName} account`,
      html: `
        <h2>Welcome to ${appName}</h2>
        <p>Your account has been created. Use these credentials to sign in:</p>
        <p><strong>Username:</strong> ${safeUsername}</p>
        <p><strong>Password:</strong> ${safePassword}</p>
        <p>Sign in at <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>
        <p>You will be asked to choose a new password on your first login.</p>
      `,
      text: `Welcome to ${appName}\n\nUsername: ${opts.username}\nPassword: ${opts.password}\n\nSign in at ${appUrl}\n\nYou will be asked to choose a new password on your first login.`,
    };
  }

  if (template === "otp") {
    const safePassword = escapeHtml(opts.password || "");
    return {
      subject: `Your ${appName} temporary password`,
      html: `
        <h2>${appName} temporary password</h2>
        <p>Use this one-time password to sign in:</p>
        <p><strong>Username:</strong> ${safeUsername}</p>
        <p><strong>Temporary password:</strong> ${safePassword}</p>
        <p>Sign in at <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>
        <p>You must set a new password immediately after signing in.</p>
      `,
      text: `${appName} temporary password\n\nUsername: ${opts.username}\nTemporary password: ${opts.password}\n\nSign in at ${appUrl}\n\nYou must set a new password immediately after signing in.`,
    };
  }

  const safeResetUrl = escapeHtml(opts.resetUrl || "");
  return {
    subject: `Reset your ${appName} password`,
    html: `
      <h2>Reset your password</h2>
      <p>We received a request to reset the password for <strong>${safeUsername}</strong>.</p>
      <p><a href="${safeResetUrl}">Click here to choose a new password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    `,
    text: `Reset your ${appName} password\n\nWe received a request to reset the password for ${opts.username}.\n\nOpen this link to choose a new password:\n${opts.resetUrl}\n\nThis link expires in 1 hour.`,
  };
}

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  if (!requireAdmin(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: LibraryEmailBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body." }, 400);
  }

  const to = (body.to ?? "").trim();
  const template = body.template;
  const username = (body.username ?? "").trim();

  if (!to || !template || !username) {
    return c.json({ error: "to, template, and username are required." }, 400);
  }

  if (!["credentials", "password-reset", "otp"].includes(template)) {
    return c.json({ error: "Invalid template." }, 400);
  }

  if ((template === "credentials" || template === "otp") && !body.password) {
    return c.json({ error: "password is required for this template." }, 400);
  }

  if (template === "password-reset" && !body.resetUrl) {
    return c.json({ error: "resetUrl is required for password-reset." }, 400);
  }

  const { subject, html, text } = buildEmail(template, {
    username,
    password: body.password,
    resetUrl: body.resetUrl,
    appUrl: body.appUrl,
  });

  try {
    await c.env.EMAIL.send({
      to,
      from: { email: c.env.FROM_EMAIL, name: "Eva's Library" },
      subject: sanitizeHeaderValue(subject),
      html,
      text,
    });
  } catch (err) {
    console.error("Library email failed", err);
    return c.json({ error: "Failed to send email." }, 500);
  }

  return c.json({ success: true });
});

export default app;
