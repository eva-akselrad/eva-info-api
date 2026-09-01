import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  latest_update?: string | null;
  latest_update_at?: string | null;
  monitors?: Array<{ slug: string; name: string }>;
}

function statusLabel(status: string): string {
  if (status === "operational") return "All systems operational";
  if (status === "degraded") return "Partial outage";
  return "Major outage";
}

function impactLabel(impact: string): string {
  if (impact === "critical") return "Critical impact";
  if (impact === "major") return "Major impact";
  if (impact === "minor") return "Minor impact";
  return "No user impact";
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
  const hasActiveIncidents = activeIncidents.length > 0;
  const worstImpact = hasActiveIncidents
    ? activeIncidents.reduce((worst, inc) => {
        const order = ["none", "minor", "major", "critical"];
        return order.indexOf(inc.impact) > order.indexOf(worst) ? inc.impact : worst;
      }, "none")
    : "none";

  if (error) {
    return (
      <div className="page">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page">
      {selectedSlug && (
        <ServiceDetail slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
      )}

      <header className="header">
        <h1>Eva Akselrad Status</h1>
        <p className="subtitle">Uptime and incidents for evaakselrad.com services</p>
        {summary && (
          <div className={`overall ${hasActiveIncidents ? "overall-alert" : ""}`}>
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

      {hasActiveIncidents && (
        <section className="section incidents-hero" aria-label="Active incidents">
          <div className={`incidents-banner impact-${worstImpact}`}>
            <div className="incidents-banner-head">
              <span className="incidents-banner-icon" aria-hidden="true">!</span>
              <div>
                <h2 className="incidents-banner-title">
                  {activeIncidents.length} active incident{activeIncidents.length === 1 ? "" : "s"}
                </h2>
                <p className="incidents-banner-sub">
                  {worstImpact === "critical" || worstImpact === "major"
                    ? "Some services may be unavailable right now."
                    : "We are tracking an issue — details below."}
                </p>
              </div>
            </div>
          </div>

          {activeIncidents.map((inc) => (
            <article className={`incident-feature impact-${inc.impact}`} key={inc.id}>
              <div className="incident-feature-head">
                <h3>{inc.title}</h3>
                <div className="incident-badges">
                  <span className={`impact-badge ${inc.impact}`}>{impactLabel(inc.impact)}</span>
                  <span className="status-pill">{inc.status}</span>
                  {inc.auto ? <span className="status-pill auto">automated</span> : null}
                </div>
              </div>

              {inc.latest_update ? (
                <p className="incident-body">{inc.latest_update}</p>
              ) : null}

              {inc.monitors?.length ? (
                <div className="incident-services">
                  <span className="incident-services-label">Affected:</span>
                  {inc.monitors.map((m) => (
                    <span className="service-tag" key={m.slug}>{m.name}</span>
                  ))}
                </div>
              ) : null}

              <div className="incident-meta">
                Opened {formatDate(inc.created_at)}
                {inc.latest_update_at ? ` · Updated ${formatDate(inc.latest_update_at)}` : ""}
              </div>
            </article>
          ))}
        </section>
      )}

      {!hasActiveIncidents && (
        <section className="section">
          <div className="all-clear-banner">
            <span className="status-dot operational" />
            <div>
              <strong>No active incidents</strong>
              <p className="all-clear-sub">All monitored services are operating normally.</p>
            </div>
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section className="section" key={group}>
          <h2>{group}</h2>
          <div className="group-card">
            {services
              .filter((s) => s.group === group)
              .map((service) => (
                <button
                  type="button"
                  className="service-row service-row-btn"
                  key={service.slug}
                  onClick={() => setSelectedSlug(service.slug)}
                >
                  <div className="service-name">{service.name}</div>
                  <div className="uptime-bar" title="90-day uptime">
                    <div className="uptime-fill" style={{ width: `${service.uptime90d}%` }} />
                  </div>
                  <span className="uptime-text">{service.uptime90d}%</span>
                  <span className={`badge ${service.status}`}>{service.status}</span>
                </button>
              ))}
          </div>
        </section>
      ))}

      {incidents?.resolved?.length ? (
        <section className="section">
          <h2>Recently resolved</h2>
          {incidents.resolved.slice(0, 5).map((inc) => (
            <div className="incident-card resolved" key={inc.id}>
              <h3>{inc.title}</h3>
              <div className="incident-meta">
                Resolved {inc.resolved_at ? formatDate(inc.resolved_at) : "—"}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="section">
        <h2>Subscribe to updates</h2>
        <div className="admin-card subscribe-card">
          <p className="hint section-hint">
            Get an email when incidents open or resolve. We will send a confirmation link first.
          </p>
          <form className="subscribe-form" onSubmit={handleSubscribe}>
            <input
              type="email"
              className="field-input"
              placeholder="your@email.com"
              value={subscribeEmail}
              onChange={(e) => setSubscribeEmail(e.target.value)}
              required
            />
            <label className="digest-check">
              <input
                type="checkbox"
                checked={subscribeDigest}
                onChange={(e) => setSubscribeDigest(e.target.checked)}
              />
              Also send daily digest (8am ET)
            </label>
            <button type="submit" className="btn primary">Subscribe</button>
          </form>
          {subscribeMsg && <p className="notice success inline-notice">{subscribeMsg}</p>}
          {subscribeErr && <p className="notice error inline-notice">{subscribeErr}</p>}
        </div>
      </section>

      <footer className="footer">
        <a href="/feed.xml">Atom feed</a> ·{" "}
        <a href="https://evaakselrad.com">evaakselrad.com</a>
      </footer>
    </div>
  );
}
