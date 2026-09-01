import { useEffect, useState } from "react";

interface Service {
  slug: string;
  name: string;
  group: string;
  url: string;
  status: string;
  lastCheckedAt: string | null;
  latencyMs: number | null;
  uptime90d: number;
}

interface StatusSummary {
  status: "operational" | "degraded" | "outage";
  summary: { total: number; up: number; down: number };
  updatedAt: string;
}

interface Incident {
  id: number;
  title: string;
  status: string;
  impact: string;
  auto: number;
  created_at: string;
  resolved_at: string | null;
}

function statusLabel(status: string): string {
  if (status === "operational") return "All systems operational";
  if (status === "degraded") return "Partial outage";
  return "Major outage";
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function App() {
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<{ active: Incident[]; resolved: Incident[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statusRes, servicesRes, incidentsRes] = await Promise.all([
          fetch("/api/v1/status/status"),
          fetch("/api/v1/status/services"),
          fetch("/api/v1/incidents"),
        ]);

        if (!statusRes.ok || !servicesRes.ok || !incidentsRes.ok) {
          throw new Error("Failed to load status data");
        }

        setSummary(await statusRes.json());
        const servicesData = (await servicesRes.json()) as { services?: Service[] };
        setServices(servicesData.services ?? []);
        setIncidents(await incidentsRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    }

    load();
    const interval = setInterval(load, 180000);
    return () => clearInterval(interval);
  }, []);

  const groups = [...new Set(services.map((s) => s.group))];

  if (error) {
    return (
      <div className="page">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Eva Akselrad Status</h1>
        <p className="subtitle">Uptime and incidents for evaakselrad.com services</p>
        {summary && (
          <div className="overall">
            <span className={`status-dot ${summary.status}`} />
            <div>
              <div className="status-label">{statusLabel(summary.status)}</div>
              <div className="status-meta">
                {summary.summary.up} of {summary.summary.total} services up · Updated{" "}
                {formatDate(summary.updatedAt)}
              </div>
            </div>
          </div>
        )}
      </header>

      {groups.map((group) => (
        <section className="section" key={group}>
          <h2>{group}</h2>
          <div className="group-card">
            {services
              .filter((s) => s.group === group)
              .map((service) => (
                <div className="service-row" key={service.slug}>
                  <div className="service-name">
                    <a href={service.url} target="_blank" rel="noreferrer">{service.name}</a>
                  </div>
                  <div className="uptime-bar" title="90-day uptime">
                    <div className="uptime-fill" style={{ width: `${service.uptime90d}%` }} />
                  </div>
                  <span className="uptime-text">{service.uptime90d}%</span>
                  <span className={`badge ${service.status}`}>{service.status}</span>
                </div>
              ))}
          </div>
        </section>
      ))}

      <section className="section">
        <h2>Active incidents</h2>
        {!incidents?.active?.length ? (
          <p className="empty">No active incidents.</p>
        ) : (
          incidents.active.map((inc) => (
            <div className="incident-card" key={inc.id}>
              <h3>{inc.title}</h3>
              <div className="incident-meta">
                {inc.status} · {inc.impact} · {formatDate(inc.created_at)}
                {inc.auto ? " · auto" : ""}
              </div>
            </div>
          ))
        )}
      </section>

      {incidents?.resolved?.length ? (
        <section className="section">
          <h2>Recent resolved</h2>
          {incidents.resolved.slice(0, 5).map((inc) => (
            <div className="incident-card" key={inc.id}>
              <h3>{inc.title}</h3>
              <div className="incident-meta">
                Resolved {inc.resolved_at ? formatDate(inc.resolved_at) : "—"}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <footer className="footer">
        <a href="/feed.xml">Atom feed</a> ·{" "}
        <a href="https://evaakselrad.com">evaakselrad.com</a> ·{" "}
        <a href="/admin">Admin</a>
      </footer>
    </div>
  );
}
