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

const ALL_ALLOWED_ORIGINS = [...new Set(
  Object.values(CONTACT_ROUTES).flatMap((route) => route.allowedOrigins),
)];

function corsHeaders(origin: string | null | undefined, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function routeForProject(project: string): ContactRoute | undefined {
  return CONTACT_ROUTES[project];
}

function routeForOrigin(origin: string | null | undefined): ContactRoute | undefined {
  if (!origin) return undefined;
  return Object.values(CONTACT_ROUTES).find((route) => route.allowedOrigins.includes(origin));
}

const app = new Hono<{ Bindings: Env }>();

app.options("/", (c) => {
  const origin = c.req.header("Origin");
  const project = c.req.query("project") ?? "";
  const route = routeForProject(project) ?? routeForOrigin(origin);

  if (!route) {
    return new Response(null, {
      status: 403,
      headers: corsHeaders(origin, ALL_ALLOWED_ORIGINS),
    });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, route.allowedOrigins),
  });
});

app.post("/", async (c) => {
  const origin = c.req.header("Origin");
  const originRoute = routeForOrigin(origin);
  const cors = corsHeaders(origin, originRoute?.allowedOrigins ?? ALL_ALLOWED_ORIGINS);

  let body: {
    project?: string;
    name?: string;
    email?: string;
    message?: string;
    turnstileToken?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body." }, 400, cors);
  }

  const project = body.project?.trim() ?? c.req.query("project") ?? "";
  const route = routeForProject(project);
  if (!route) return c.json({ error: "Unknown project" }, 400, cors);

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
