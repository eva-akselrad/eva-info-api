import { Hono } from "hono";
import type { ContactRoute, Env } from "../types";
import { checkRateLimit, sendContactEmail, validateContactFields } from "../lib/email";
import { verifyTurnstile } from "../lib/turnstile";

const CONTACT_ROUTES: Record<string, ContactRoute> = {
  portfolio: {
    to: "business@evaakselrad.com",
    fromEmail: "noreply@evaakselrad.com",
    fromName: "Eva Akselrad Portfolio",
    subjectPrefix: "Portfolio Contact",
    allowedOrigins: ["https://evaakselrad.com", "https://www.evaakselrad.com"],
  },
};

const app = new Hono<{ Bindings: Env }>();

function corsHeaders(origin: string | null | undefined, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

app.options("/", (c) => {
  const project = c.req.query("project") ?? "";
  const route = CONTACT_ROUTES[project];
  if (!route) return c.text("", 404);

  const origin = c.req.header("Origin");
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, route.allowedOrigins),
  });
});

app.post("/", async (c) => {
  const body = await c.req.json<{
    project?: string;
    name?: string;
    email?: string;
    message?: string;
    turnstileToken?: string;
  }>();

  const project = body.project?.trim() ?? c.req.query("project") ?? "";
  const route = CONTACT_ROUTES[project];
  if (!route) return c.json({ error: "Unknown project" }, 400);

  const origin = c.req.header("Origin");
  const cors = corsHeaders(origin, route.allowedOrigins);
  if (origin && !route.allowedOrigins.includes(origin)) {
    return c.json({ error: "Origin not allowed" }, 403, cors);
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const message = (body.message ?? "").trim();
  const turnstileToken = body.turnstileToken ?? "";

  const fieldError = validateContactFields(name, email, message);
  if (fieldError) return c.json({ error: fieldError }, 400, cors);

  if (!turnstileToken) {
    return c.json({ error: "Please complete the verification challenge." }, 400, cors);
  }

  const secret = c.env.TURNSTILE_SECRET_PORTFOLIO;
  if (!secret) {
    console.error("TURNSTILE_SECRET_PORTFOLIO not configured");
    return c.json({ error: "Server configuration error." }, 500, cors);
  }

  const ip = c.req.header("CF-Connecting-IP");
  const allowed = await checkRateLimit(c.env.DB, `contact:${project}:${ip ?? "unknown"}`, 5, 900);
  if (!allowed) return c.json({ error: "Too many requests. Please try again later." }, 429, cors);

  const verified = await verifyTurnstile(turnstileToken, secret, ip);
  if (!verified) return c.json({ error: "Verification failed. Please try again." }, 403, cors);

  try {
    await sendContactEmail(c.env, {
      to: route.to,
      fromEmail: route.fromEmail,
      fromName: route.fromName,
      subjectPrefix: route.subjectPrefix,
      name,
      email,
      message,
    });
  } catch (err) {
    console.error("Contact email failed", err);
    return c.json({ error: "Failed to send message. Please try again later." }, 500, cors);
  }

  return c.json({ success: true }, 200, cors);
});

export default app;
