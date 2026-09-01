import type { Env } from "../types";

export function requireAdmin(c: { req: { header: (name: string) => string | undefined }; env: Env }): boolean {
  const key = c.env.ADMIN_API_KEY;
  if (!key) return false;
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice(7) === key;
}
