# FactoryPulse — MES Operations Hub

A prototype web app for factory users, MES support teams and production managers.
React 18 · TypeScript · Tailwind CSS · Vite. **No backend, no paid APIs, no real data** — everything runs locally with synthetic sample data persisted in `localStorage`.

> Not connected to SAP or any manufacturing system. See [docs/INTEGRATION.md](docs/INTEGRATION.md) for the
> API, authentication, authorization and audit-logging design needed for production.

## Run

```bash
npm install
npm run dev      # http://localhost:5173 (app only)
npm run dev:all  # app + SLA notifier (email / Teams)
npm run build    # typecheck + production build
```

## Modules

| Module | Route | Highlights |
|---|---|---|
| Dashboard | `/` | KPIs (open, SLA breaches, nearing SLA, orders, blocked work centers, alerts), trend/top-error/factory charts, global filters |
| Incidents | `/incidents`, `/incidents/:id` | Create/assign/update/close, history timeline, resolution notes required to close, SLA highlighting, search + filters, sortable/paged table |
| Troubleshooting | `/assistant` | Retrieval over *approved* KB articles, cites source, shows "no confirmed resolution" when nothing matches |
| Production | `/production` | Orders by factory/work center, progress, downtime, blocked & delayed flags, alerts |
| Shiftbook | `/shiftbook` | Handover entries, follow-up tasks, unresolved tasks from earlier shifts |
| Knowledge Center | `/knowledge` | Search, categories, create/edit/approve/delete articles |
| Reports | `/reports` | Volume by factory/application, SLA %, recurring errors, avg. resolution, downtime trend, CSV export |

## Design notes

* **Service seam:** UI → `src/services/contracts.ts` (interfaces) → `src/services/local.ts` (mock). Replace the implementation, not the UI, to integrate real systems.
* **SLA rules:** Critical 4h · High 8h · Medium 24h · Low 72h; *At risk* = last 25% of the window; breached once the deadline passes while open.
* **Production delay rule:** an in-progress order is delayed when produced/planned lags elapsed time by >15 points.
* **Sample data** is generated relative to "now" so SLA states are always realistic; use *Reset sample data* in the sidebar to regenerate.
* **Testing states:** the sidebar toggle *Simulate API error* demonstrates error states; skeleton spinners show loading (≈280 ms simulated latency).

## SLA alerts (email + Microsoft Teams)

An SLA watcher in the app checks open incidents every 30 s. It sends an **at-risk** alert when 25% of the SLA window is left and a **breached** alert when the deadline passes (once per incident and stage). Alerts also appear as toasts, a badge on **SLA Alerts** in the sidebar, and a log page.

Delivery is done by `server/notifier.mjs` (credentials never reach the browser):

```bash
cp .env.example .env     # set SMTP_*, ALERT_EMAIL_FROM/TO and/or TEAMS_WEBHOOK_URL
npm run dev:all
```

With no `.env` it runs in **dry-run** mode and only writes `server/outbox.log`. Teams: create a channel workflow "Post to a channel when a webhook request is received" (or an Incoming Webhook) and paste the URL.
