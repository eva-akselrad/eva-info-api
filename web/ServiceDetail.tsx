import { useEffect, useState } from "react";

interface ServiceDetailData {
  service: {
    slug: string;
    name: string;
    group: string;
    url: string;
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
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{data?.service.name ?? slug}</h2>
          <button type="button" className="btn subtle" onClick={onClose}>Close</button>
        </div>

        {error && <div className="notice error">{error}</div>}
        {!data && !error && <p className="empty">Loading…</p>}

        {data && (
          <>
            <p className="modal-meta">
              <a href={data.service.url} target="_blank" rel="noreferrer">{data.service.url}</a>
              · <span className={`badge ${data.service.status}`}>{data.service.status}</span>
            </p>

            <div className="uptime-grid">
              <div className="uptime-stat"><span>7d</span><strong>{data.uptime.days7}%</strong></div>
              <div className="uptime-stat"><span>30d</span><strong>{data.uptime.days30}%</strong></div>
              <div className="uptime-stat"><span>90d</span><strong>{data.uptime.days90}%</strong></div>
            </div>

            {data.daily.length > 0 && (
              <div className="daily-chart" aria-hidden="true">
                {data.daily.map((d) => {
                  const pct = d.total ? (d.ok_count / d.total) * 100 : 100;
                  return (
                    <div
                      key={d.day}
                      className="daily-bar"
                      style={{ height: `${Math.max(4, pct * 0.48)}px` }}
                      title={`${d.day}: ${pct.toFixed(1)}%`}
                    />
                  );
                })}
              </div>
            )}

            <h3 className="modal-subhead">Incidents</h3>
            {!data.incidents.length ? (
              <p className="empty">No incidents recorded for this service.</p>
            ) : (
              data.incidents.map((inc) => (
                <div className="incident-card" key={inc.id}>
                  <h4>{inc.title}</h4>
                  <div className="incident-meta">
                    {inc.impact} · {inc.status} · {formatDate(inc.created_at)}
                    {inc.resolved_at ? ` · resolved ${formatDate(inc.resolved_at)}` : ""}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
