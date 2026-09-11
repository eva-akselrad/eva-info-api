import { useEffect, useState, type FormEvent } from "react";
import ServiceDetail from "./ServiceDetail";

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
  summary: { total: number; up: number; down: number; maintenance: number };
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
  latest_update?: string | null;
  latest_update_at?: string | null;
  monitors?: Array<{ slug: string; name: string }>;
}

function statusLabel(status: string): string {
  if (status === "operational") return "All systems operational";
  if (status === "degraded") return "Partial system disruption";
  return "Major system outage";
}

function statusDescription(status: string, up: number, total: number): string {
  if (status === "operational") return `All ${total} monitored components are responding normally.`;
  if (status === "degraded") return `${up} of ${total} components operational. Some services may be affected.`;
  return `Critical issues detected across monitored services.`;
}

function impactLabel(impact: string): string {
  if (impact === "critical") return "Critical";
  if (impact === "major") return "Major";
  if (impact === "minor") return "Minor";
  return "None";
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusIndicator({ status }: { status: string }) {
  const label =
    status === "up" ? "Operational" : status === "down" ? "Down" : status === "maintenance" ? "PC offline" : "Unknown";
  return (
    <span className={`status-indicator status-indicator--${status}`}>
      <span className="status-indicator-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export default function App() {
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<{ active: Incident[]; resolved: Incident[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeDigest, setSubscribeDigest] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<string | null>(null);
  const [subscribeErr, setSubscribeErr] = useState<string | null>(null);

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

  async function handleSubscribe(e: FormEvent) {
    e.preventDefault();
    setSubscribeMsg(null);
    setSubscribeErr(null);
    try {
      const res = await fetch("/api/v1/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: subscribeEmail.trim(), digest: subscribeDigest }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Subscribe failed");
      setSubscribeMsg(data.message ?? "Check your email to confirm.");
      setSubscribeEmail("");
    } catch (err) {
      setSubscribeErr(err instanceof Error ? err.message : "Subscribe failed");
    }
  }

  const groups = [...new Set(services.map((s) => s.group))];
  const activeIncidents = incidents?.active ?? [];

  if (error) {
    return (
      <div className="site">
        <main className="site-main">
          <div className="notice error">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="site">
      {selectedSlug && (
        <ServiceDetail slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
      )}

      <header className="site-header">
        <div className="site-brand">
          <a className="site-brand-name" href="https://evaakselrad.com">Eva Akselrad</a>
          <span className="site-brand-divider" aria-hidden="true">/</span>
          <span className="site-brand-page">System Status</span>
        </div>
        {summary && (
          <time className="site-updated" dateTime={summary.updatedAt}>
            Updated {formatDate(summary.updatedAt)}
          </time>
        )}
      </header>

      <main className="site-main">
        {summary && (
          <section
            className={`status-hero status-hero--${summary.status}`}
            aria-label="Current system status"
          >
            <div className="status-hero-icon" aria-hidden="true">
              <span className={`status-hero-dot status-hero-dot--${summary.status}`} />
            </div>
            <div className="status-hero-body">
              <h1>{statusLabel(summary.status)}</h1>
              <p>{statusDescription(summary.status, summary.summary.up, summary.summary.total)}</p>
            </div>
          </section>
        )}

        {activeIncidents.length > 0 && (
          <section className="content-section" aria-label="Active incidents">
            <div className="section-heading">
              <h2>Active incidents</h2>
              <span className="section-count">{activeIncidents.length}</span>
            </div>
            <div className="incident-list">
              {activeIncidents.map((inc) => (
                <article className={`incident-item incident-item--${inc.impact}`} key={inc.id}>
                  <div className="incident-item-header">
                    <h3>{inc.title}</h3>
                    <div className="incident-item-tags">
                      <span className={`tag tag--${inc.impact}`}>{impactLabel(inc.impact)}</span>
                      <span className="tag tag--neutral">{inc.status}</span>
                      {inc.auto ? <span className="tag tag--neutral">Automated</span> : null}
                    </div>
                  </div>
                  {inc.latest_update && <p className="incident-item-body">{inc.latest_update}</p>}
                  {inc.monitors?.length ? (
                    <div className="incident-item-services">
                      {inc.monitors.map((m) => (
                        <span className="tag tag--outline" key={m.slug}>{m.name}</span>
                      ))}
                    </div>
                  ) : null}
                  <footer className="incident-item-footer">
                    Opened {formatDate(inc.created_at)}
                    {inc.latest_update_at ? ` · Updated ${formatDate(inc.latest_update_at)}` : ""}
                  </footer>
                </article>
              ))}
            </div>
          </section>
        )}

        {groups.map((group) => (
          <section className="content-section" key={group}>
            <div className="section-heading">
              <h2>{group}</h2>
            </div>
            <div className="service-table">
              <div className="service-table-header" aria-hidden="true">
                <span>Component</span>
                <span>90-day uptime</span>
                <span>Status</span>
              </div>
              {services
                .filter((s) => s.group === group)
                .map((service) => (
                  <button
                    type="button"
                    className="service-table-row"
                    key={service.slug}
                    onClick={() => setSelectedSlug(service.slug)}
                  >
                    <span className="service-table-name">{service.name}</span>
                    <span className="service-table-uptime">
                      <span className="uptime-track" aria-hidden="true">
                        <span
                          className="uptime-track-fill"
                          style={{ width: `${service.uptime90d}%` }}
                        />
                      </span>
                      <span className="uptime-value">{service.uptime90d}%</span>
                    </span>
                    <StatusIndicator status={service.status} />
                  </button>
                ))}
            </div>
          </section>
        ))}

        {incidents?.resolved?.length ? (
          <section className="content-section">
            <div className="section-heading">
              <h2>Recently resolved</h2>
            </div>
            <div className="resolved-list">
              {incidents.resolved.slice(0, 5).map((inc) => (
                <div className="resolved-item" key={inc.id}>
                  <span className="resolved-title">{inc.title}</span>
                  <span className="resolved-date">
                    {inc.resolved_at ? formatDate(inc.resolved_at) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="content-section subscribe-section">
          <div className="section-heading">
            <h2>Subscribe to updates</h2>
          </div>
          <div className="panel">
            <p className="panel-lead">
              Receive email notifications when incidents are opened or resolved.
              A confirmation link is required before messages are sent.
            </p>
            <form className="subscribe-form" onSubmit={handleSubscribe}>
              <div className="subscribe-row">
                <input
                  type="email"
                  className="field-input"
                  placeholder="Email address"
                  value={subscribeEmail}
                  onChange={(e) => setSubscribeEmail(e.target.value)}
                  required
                  aria-label="Email address"
                />
                <button type="submit" className="btn btn-primary">Subscribe</button>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={subscribeDigest}
                  onChange={(e) => setSubscribeDigest(e.target.checked)}
                />
                Include daily digest (8:00 AM ET)
              </label>
            </form>
            {subscribeMsg && <p className="notice success">{subscribeMsg}</p>}
            {subscribeErr && <p className="notice error">{subscribeErr}</p>}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <nav className="site-footer-nav" aria-label="Footer">
          <a href="/feed.xml">Atom feed</a>
          <a href="https://evaakselrad.com">evaakselrad.com</a>
        </nav>
        <p className="site-footer-note">Checks run every 3 minutes from Cloudflare Workers.</p>
      </footer>
    </div>
  );
}
