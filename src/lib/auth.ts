import type { Env } from "../types";

export const SCOPES = {
  STATUS_READ: "status:read",
  STATUS_WRITE: "status:write",
  ADMIN: "admin:*",
} as const;

export type ApiScope = typeof SCOPES[keyof typeof SCOPES] | string;

function bearerToken(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function hashKey(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getAuthScopes(
  c: { req: { header: (name: string) => string | undefined }; env: Env },
): Promise<string[] | null> {
  const token = bearerToken(c);
  if (!token) return null;

  if (c.env.ADMIN_API_KEY && token === c.env.ADMIN_API_KEY) {
    return [SCOPES.STATUS_READ, SCOPES.STATUS_WRITE, SCOPES.ADMIN];
  }

  const hash = await hashKey(token);
  const row = await c.env.DB.prepare(`SELECT scopes FROM api_keys WHERE key_hash = ?`)
    .bind(hash)
    .first<{ scopes: string }>();

  if (!row) return null;
  try {
    return JSON.parse(row.scopes) as string[];
  } catch {
    return null;
  }
}

export function scopesAllow(scopes: string[] | null, required: string): boolean {
  if (!scopes) return false;
  if (scopes.includes(SCOPES.ADMIN)) return true;
  if (required === SCOPES.STATUS_READ) return scopes.includes(SCOPES.STATUS_READ) || scopes.includes(SCOPES.STATUS_WRITE);
  return scopes.includes(required);
}

export async function requireScope(
  c: { req: { header: (name: string) => string | undefined }; env: Env },
  scope: string,
): Promise<boolean> {
  const scopes = await getAuthScopes(c);
  return scopesAllow(scopes, scope);
}

export function requireAdmin(c: { req: { header: (name: string) => string | undefined }; env: Env }): boolean {
  const token = bearerToken(c);
  if (!token || !c.env.ADMIN_API_KEY) return false;
  return token === c.env.ADMIN_API_KEY;
}

export async function requireAdminOrScope(
  c: { req: { header: (name: string) => string | undefined }; env: Env },
  scope: string,
): Promise<boolean> {
  if (requireAdmin(c)) return true;
  return await requireScope(c, scope);
}

export async function createApiKey(
  env: Env,
  name: string,
  scopes: string[],
): Promise<string> {
  const raw = `eva_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyHash = await hashKey(raw);
  await env.DB.prepare(`INSERT INTO api_keys (name, key_hash, scopes) VALUES (?, ?, ?)`)
    .bind(name, keyHash, JSON.stringify(scopes))
    .run();
  return raw;
}
