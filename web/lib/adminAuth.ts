const STORAGE_KEY = "eva-status-admin-key";

export function getAdminKey(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setAdminKey(key: string): void {
  sessionStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearAdminKey(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function adminFetch(
  path: string,
  key: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${key}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...options, headers });
}
