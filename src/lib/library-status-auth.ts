import type { Env } from "../types";
import { requireAdminOrScope, SCOPES } from "./auth";

export async function requireLibraryStatusControl(
  c: { req: { header: (name: string) => string | undefined }; env: Env },
): Promise<boolean> {
  if (await requireAdminOrScope(c, SCOPES.STATUS_WRITE)) return true;

  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  return Boolean(c.env.LIBRARY_STATUS_CONTROL_TOKEN && token === c.env.LIBRARY_STATUS_CONTROL_TOKEN);
}
