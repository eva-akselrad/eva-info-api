import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminFetch, clearAdminKey, getAdminKey, setAdminKey } from "./lib/adminAuth";
import { INCIDENT_TEMPLATES, UPDATE_TEMPLATES } from "./lib/incidentTemplates";

interface Service {
  slug: string;
  name: string;
  group: string;
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

const IMPACTS = ["none", "minor", "major", "critical"] as const;
const STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;

function formatDate(s: string): string {
  return new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function Admin() {
  const [keyInput, setKeyInput] = useState("");
  const [key, setKey] = useState<string | null>(() => getAdminKey());
  const [services, setServices] = useState<Service[]>([]);
  const [active, setActive] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [impact, setImpact] = useState<string>("minor");
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>([]);

  const [updateText, setUpdateText] = useState<Record<number, string>>({});
  const [updateStatus, setUpdateStatus] = useState<Record<number, string>>({});

  const load = useCallback(async (adminKey: string) => {
    setError(null);
    try {
      const [servicesRes, incidentsRes] = await Promise.all([
        fetch("/api/v1/status/services"),
        fetch("/api/v1/incidents"),
      ]);

      if (!servicesRes.ok || !incidentsRes.ok) throw new Error("Failed to load data");

      const servicesData = (await servicesRes.json()) as { services?: Service[] };
      setServices(servicesData.services ?? []);

      const incidentsData = (await incidentsRes.json()) as { active?: Incident[] };
      setActive(incidentsData.active ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    if (key) load(key);
  }, [key, load]);

  function saveKey() {
    if (!keyInput.trim()) return;
    setAdminKey(keyInput);
    setKey(keyInput.trim());
    setKeyInput("");
    setMessage("Admin key saved for this browser session.");
  }

  function logout() {
    clearAdminKey();
    setKey(null);
    setMessage(null);
    setError(null);
  }

  async function createIncident(e: FormEvent) {
    e.preventDefault();
    if (!key || !title.trim()) return;
    setError(null);
    setMessage(null);

    const res = await adminFetch("/api/v1/incidents", key, {
      method: "POST",
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim() || undefined,
        impact,
        monitorSlugs: selectedMonitors.length ? selectedMonitors : undefined,
      }),
    });

    const data = (await res.json()) as { id?: number; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to create incident");
      return;
    }

    setTitle("");
    setBody("");
    setImpact("minor");
    setSelectedMonitors([]);
    setMessage(`Incident #${data.id} created.`);
    await load(key);
  }

  async function postUpdate(id: number, resolve = false) {
    if (!key) return;
    setError(null);
    setMessage(null);

    const text = updateText[id]?.trim();
    const status = updateStatus[id];

    const res = await adminFetch(`/api/v1/incidents/${id}`, key, {
      method: "PATCH",
      body: JSON.stringify({
        body: text || undefined,
        status: resolve ? undefined : status || undefined,
        resolve,
      }),
    });

    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Update failed");
      return;
    }

    setUpdateText((prev) => ({ ...prev, [id]: "" }));
    setMessage(resolve ? `Incident #${id} resolved.` : `Incident #${id} updated.`);
    await load(key);
  }

  async function runChecks() {
    if (!key) return;
    setError(null);
    const res = await adminFetch("/api/v1/admin/run-checks", key, { method: "POST" });
    if (!res.ok) {
      setError("Failed to run health checks");
      return;
    }
    setMessage("Health checks completed.");
  }

  function toggleMonitor(slug: string) {
    setSelectedMonitors((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function applyTemplate(templateId: string) {
    const template = INCIDENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setTitle(template.title);
    setBody(template.body);
    setImpact(template.impact);
    setSelectedMonitors(template.monitorSlugs);
    setMessage(`Template “${template.label}” applied — edit if needed, then create.`);
  }

  function applyUpdateTemplate(incidentId: number, templateId: string) {
    const template = UPDATE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setUpdateText((prev) => ({ ...prev, [incidentId]: template.body }));
    setUpdateStatus((prev) => ({ ...prev, [incidentId]: template.status }));
  }

  async function createFromTemplate(templateId: string) {
    const template = INCIDENT_TEMPLATES.find((t) => t.id === templateId);
    if (!template || !key) return;
    setError(null);
    setMessage(null);

    const res = await adminFetch("/api/v1/incidents", key, {
      method: "POST",
      body: JSON.stringify({
        title: template.title,
        body: template.body,
        impact: template.impact,
        monitorSlugs: template.monitorSlugs.length ? template.monitorSlugs : undefined,
      }),
    });

    const data = (await res.json()) as { id?: number; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to create incident");
      return;
    }

    setMessage(`Created incident #${data.id} from “${template.label}”.`);
    await load(key);
  }

  if (!key) {
    return (
      <div className="page">
        <header className="header">
          <h1>Status Admin</h1>
          <p className="subtitle">Enter your admin API key to manage incidents.</p>
        </header>

        <div className="admin-card">
          <label className="field-label" htmlFor="admin-key">Admin API key</label>
          <input
            id="admin-key"
            type="password"
            className="field-input"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="From .admin-key.txt or wrangler secret"
            autoComplete="off"
          />
          <button type="button" className="btn primary" onClick={saveKey}>Unlock admin</button>
          <p className="hint">
            Key is stored in sessionStorage only (cleared when you close the tab).{" "}
            <a href="/">Back to status page</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <div className="admin-header-row">
          <div>
            <h1>Status Admin</h1>
            <p className="subtitle">Create and manage incidents</p>
          </div>
          <div className="admin-actions-top">
            <button type="button" className="btn subtle" onClick={runChecks}>Run checks now</button>
            <button type="button" className="btn subtle" onClick={logout}>Lock</button>
            <a className="btn subtle link-btn" href="/">Public page</a>
          </div>
        </div>
      </header>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <section className="section">
        <h2>Quick templates</h2>
        <p className="hint section-hint">
          Click to fill the form, or use the lightning button to create immediately.
        </p>
        <div className="template-grid">
          {INCIDENT_TEMPLATES.map((t) => (
            <div className="template-card" key={t.id}>
              <div className="template-card-head">
                <strong>{t.label}</strong>
                <span className={`impact-badge ${t.impact}`}>{t.impact}</span>
              </div>
              <p className="template-preview">{t.title}</p>
              <div className="btn-row">
                <button type="button" className="btn subtle" onClick={() => applyTemplate(t.id)}>
                  Use template
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => createFromTemplate(t.id)}
                  title="Create incident immediately"
                >
                  Create now
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>New incident</h2>
        <form className="admin-card form-grid" onSubmit={createIncident}>
          <label className="field-label" htmlFor="inc-title">Title</label>
          <input
            id="inc-title"
            className="field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Planned maintenance on CardFest"
          />

          <label className="field-label" htmlFor="inc-body">Message</label>
          <textarea
            id="inc-body"
            className="field-input"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What’s happening and what users should expect?"
          />

          <label className="field-label" htmlFor="inc-impact">Impact</label>
          <select
            id="inc-impact"
            className="field-input"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
          >
            {IMPACTS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <div className="field-label">Affected services (optional)</div>
          <div className="monitor-grid">
            {services.map((s) => (
              <label key={s.slug} className="monitor-chip">
                <input
                  type="checkbox"
                  checked={selectedMonitors.includes(s.slug)}
                  onChange={() => toggleMonitor(s.slug)}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>

          <button type="submit" className="btn primary">Create incident</button>
        </form>
      </section>

      <section className="section">
        <h2>Active incidents ({active.length})</h2>
        {!active.length ? (
          <p className="empty">No active incidents.</p>
        ) : (
          active.map((inc) => (
            <div className="admin-card incident-admin" key={inc.id}>
              <div className="incident-admin-head">
                <h3>#{inc.id} — {inc.title}</h3>
                <span className="incident-meta">
                  {inc.status} · {inc.impact} · {formatDate(inc.created_at)}
                  {inc.auto ? " · auto" : ""}
                </span>
              </div>

              <label className="field-label" htmlFor={`status-${inc.id}`}>Status</label>
              <select
                id={`status-${inc.id}`}
                className="field-input"
                value={updateStatus[inc.id] ?? inc.status}
                onChange={(e) =>
                  setUpdateStatus((prev) => ({ ...prev, [inc.id]: e.target.value }))
                }
              >
                {STATUSES.filter((s) => s !== "resolved").map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <label className="field-label" htmlFor={`update-${inc.id}`}>Update message</label>
              <div className="update-template-row">
                {UPDATE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="btn subtle btn-sm"
                    onClick={() => applyUpdateTemplate(inc.id, t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                id={`update-${inc.id}`}
                className="field-input"
                rows={3}
                value={updateText[inc.id] ?? ""}
                onChange={(e) =>
                  setUpdateText((prev) => ({ ...prev, [inc.id]: e.target.value }))
                }
                placeholder="Post a timeline update…"
              />

              <div className="btn-row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => postUpdate(inc.id, false)}
                >
                  Post update
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => postUpdate(inc.id, true)}
                >
                  Resolve
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
