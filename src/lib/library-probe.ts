const LIBRARY_STATUS_URL = "https://library.evaakselrad.com/api/status";

export interface ProbeOutcome {
  ok: boolean;
  expectedOffline: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}

/** Probe Eva's Library tunnel origin — never fetch status.evaakselrad.com from this worker. */
export async function probeEvasLibrary(): Promise<ProbeOutcome> {
  const start = Date.now();
  try {
    const res = await fetch(LIBRARY_STATUS_URL, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "application/json",
        "User-Agent": "eva-info-api-monitor/1.0",
      },
    });

    const latencyMs = Date.now() - start;
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text.trim()) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        expectedOffline: false,
        statusCode: res.status,
        latencyMs,
        error: `Invalid JSON response (${res.status}, ${res.headers.get("content-type") ?? "unknown content type"})`,
      };
    }

    const ok = res.ok && parsed.ok === true;
    const expectedOffline = res.ok && parsed.mode === "pc_offline";
    return {
      ok: ok || expectedOffline,
      expectedOffline,
      statusCode: res.status,
      latencyMs,
      error: ok || expectedOffline ? null : `Health check failed (${res.status})`,
    };
  } catch (err) {
    return {
      ok: false,
      expectedOffline: false,
      statusCode: null,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Check failed",
    };
  }
}
