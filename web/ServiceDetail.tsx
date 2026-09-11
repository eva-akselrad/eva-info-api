import { useEffect, useState } from "react";

interface ServiceDetailData {
  service: {
    slug: string;
    name: string;
    group: string;
    url: string;
    publicUrl?: string;
    status: string;
    lastCheckedAt: string | null;
    latencyMs: number | null;
    error: string | null;
  };
  uptime: { days7: number; days30: number; days90: number };
  daily: Array<{ day: string; total: number; ok_count: number; avg_latency_ms: number }>;
  incidents: Array<{
    id: number;
    title: string;
    status: string;
    impact: string;
    created_at: string;
    resolved_at: string | null;
  }>;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function impactLabel(impact: string): string {
  if (impact === "critical") return "Critical";
  if (impact === "major") return "Major";
  if (impact === "minor") return "Minor";
  return "None";
}

export default function ServiceDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ServiceDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/status/services/${slug}/history`);
        if (!res.ok) throw new Error("Failed to load service history");
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    }
    load();
  }, [slug]);

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-detail-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="service-detail-title">{data?.service.name ?? slug}</h2>
            {data && (
              <p className="modal-header-meta">
                <a
                  href={data.service.publicUrl ?? data.service.url.replace(/\/api\/.*$/, "")}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.service.publicUrl ?? data.service.url.replace(/\/api\/.*$/, "")}
                </a>
                {data.service.latencyMs != null ? ` · ${data.service.latencyMs} ms` : ""}
                {data.service.lastCheckedAt
                  ? ` · Checked ${formatDate(data.service.lastCheckedAt)}`
                  : ""}
              </p>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="notice error">{error}</div>}
          {!data && !error && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

          {data && (
            <>
              <div className="modal-stats">
                <div className="stat-card">
                  <span className="stat-card-label">7-day uptime</span>
                  <span className="stat-card-value">{data.uptime.days7}%</span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">30-day uptime</span>
                  <span className="stat-card-value">{data.uptime.days30}%</span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">90-day uptime</span>
                  <span className="stat-card-value">{data.uptime.days90}%</span>
                </div>
              </div>

              {data.daily.length > 0 && (
                <div className="chart-container">
                  <h3 className="chart-title">90-day history</h3>
                  <div className="uptime-bars" aria-hidden="true">
                    {data.daily.map((d) => {
                      const pct = d.total ? (d.ok_count / d.total) * 100 : 100;
                      const isDown = pct < 99;
                      return (
                        <div
                          key={d.day}
                          className={`uptime-bar${isDown ? " uptime-bar--down" : ""}`}
                          title={`${d.day}: ${pct.toFixed(1)}% uptime`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <h3 className="chart-title">Incidents</h3>
              {!data.incidents.length ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem" }}>
                  No incidents recorded for this service.
                </p>
              ) : (
                <div className="incident-list">
                  {data.incidents.map((inc) => (
                    <article className={`incident-item incident-item--${inc.impact}`} key={inc.id}>
                      <div className="incident-item-header">
                        <h3>{inc.title}</h3>
                        <div className="incident-item-tags">
                          <span className={`tag tag--${inc.impact}`}>{impactLabel(inc.impact)}</span>
                          <span className="tag tag--neutral">{inc.status}</span>
                        </div>
                      </div>
                      <footer className="incident-item-footer">
                        Opened {formatDate(inc.created_at)}
                        {inc.resolved_at ? ` · Resolved ${formatDate(inc.resolved_at)}` : ""}
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
