export interface IncidentTemplate {
  id: string;
  label: string;
  title: string;
  body: string;
  impact: "none" | "minor" | "major" | "critical";
  monitorSlugs: string[];
}

export const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  {
    id: "maintenance",
    label: "Planned maintenance",
    title: "Scheduled maintenance",
    body:
      "We are performing scheduled maintenance. Some services may be briefly unavailable during this window. Updates will be posted here as work progresses.",
    impact: "minor",
    monitorSlugs: [],
  },
  {
    id: "cardfest-deploy",
    label: "CardFest deploy",
    title: "CardFest update in progress",
    body:
      "Deploying an update to the CardFest ticketing stack (API, checkout site, and scanner). Ticket purchases and QR scanning may be briefly interrupted.",
    impact: "major",
    monitorSlugs: ["cardfest-api", "cardfest-site", "cardfest-scanner"],
  },
  {
    id: "cardfest-outage",
    label: "CardFest outage",
    title: "CardFest ticketing disruption",
    body:
      "We are investigating an issue affecting CardFest ticketing. Checkout, ticket verification, or scanning may not work as expected. We are working to restore full service.",
    impact: "critical",
    monitorSlugs: ["cardfest-api", "cardfest-site", "cardfest-scanner"],
  },
  {
    id: "portfolio",
    label: "Portfolio issue",
    title: "Portfolio site issue",
    body:
      "We are investigating an issue with evaakselrad.com. The portfolio site or contact form may be unavailable. We will update this page when we know more.",
    impact: "minor",
    monitorSlugs: ["portfolio"],
  },
  {
    id: "third-party",
    label: "Third-party provider",
    title: "External provider issue",
    body:
      "An upstream provider (Cloudflare, Stripe, or email) is experiencing issues that may affect our services. We are monitoring the situation and will post updates here.",
    impact: "major",
    monitorSlugs: [],
  },
  {
    id: "degraded",
    label: "Degraded performance",
    title: "Degraded performance",
    body:
      "Some services are responding slowly or intermittently. Core functionality should still work, but you may notice delays. We are investigating.",
    impact: "minor",
    monitorSlugs: [],
  },
  {
    id: "monitoring",
    label: "Fix deployed — monitoring",
    title: "Fix deployed — monitoring recovery",
    body:
      "We have applied a fix and are monitoring services to confirm everything is stable. This incident will be resolved once checks pass consistently.",
    impact: "minor",
    monitorSlugs: [],
  },
  {
    id: "resolved-note",
    label: "All clear (resolve)",
    title: "Service restored",
    body:
      "The issue has been resolved and all monitored services are operating normally. Thank you for your patience.",
    impact: "none",
    monitorSlugs: [],
  },
];

export const UPDATE_TEMPLATES = [
  {
    id: "investigating",
    label: "Still investigating",
    body: "We are still investigating and will provide another update within 30 minutes or as soon as we have more information.",
    status: "investigating",
  },
  {
    id: "identified",
    label: "Root cause identified",
    body: "We have identified the cause of the issue and are working on a fix.",
    status: "identified",
  },
  {
    id: "monitoring",
    label: "Monitoring fix",
    body: "A fix has been deployed. We are monitoring recovery and will confirm when the incident is fully resolved.",
    status: "monitoring",
  },
  {
    id: "scheduled",
    label: "Maintenance starting",
    body: "Maintenance is now underway. Expect brief interruptions until we post an all-clear update.",
    status: "investigating",
  },
  {
    id: "resolved",
    label: "Resolved — all clear",
    body: "This incident is resolved. All affected services are operating normally.",
    status: "resolved",
  },
] as const;
