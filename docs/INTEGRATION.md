# FactoryPulse — Integration & Production Deployment Guide

> **Status:** prototype. All data is synthetic and stored in the browser (`localStorage`).
> FactoryPulse is **not connected to SAP or any manufacturing system**, and nothing in this
> repository contains real factory data or credentials.

## 1. Architecture for production

```
Browser (React SPA)
   │  HTTPS, OIDC access token (Authorization: Bearer …)
   ▼
Backend-for-Frontend (BFF) / API gateway     ← authN/authZ, rate limiting, audit logging
   ├── Incident service      (own DB)
   ├── Knowledge service     (own DB / search index)
   ├── Shiftbook service     (own DB)
   └── Integration layer ──► SAP MES / SAP ERP / historian / other MES (via adapters)
```

* The SPA depends only on the interfaces in [`src/services/contracts.ts`](../src/services/contracts.ts).
  `src/services/local.ts` is the mock implementation; production replaces it with an HTTP client
  implementing the same interfaces (`services/index.ts` is the single swap point).
* **Never call SAP or shopfloor systems from the browser.** Credentials, network reachability and
  protocol details (OData, RFC/BAPI, IDoc, OPC UA, MQTT) belong in the integration layer.
* `ManufacturingSystemAdapter` (contracts.ts) is the outbound port. Implement one adapter per
  target system (e.g. `SapMesAdapter`, `SapErpAdapter`). Today the app uses `NotConnectedAdapter`.

## 2. API surface (REST/JSON, versioned under `/api/v1`)

| Resource | Endpoints | Maps to service method |
|---|---|---|
| Incidents | `GET /incidents?factory&application&status&priority&from&to&q&page` · `POST /incidents` · `GET /incidents/{id}` · `PATCH /incidents/{id}` | `IncidentService.list/create/get/update` |
| Production orders | `GET /production-orders?factory&status` | `ProductionService.listOrders` |
| Work centers | `GET /work-centers?factory` | `listWorkCenters` |
| Alerts | `GET /alerts?resolved=false` · `POST /alerts/{id}:resolve` | `listAlerts/resolveAlert` |
| Downtime | `GET /downtime?factory&from&to` | `listDowntime` |
| Shiftbook | `GET /shift-entries` · `POST /shift-entries` · `PATCH /shift-entries/{id}/tasks/{taskId}` | `ShiftbookService.*` |
| Knowledge | `GET /knowledge-articles?q&category&approved` · `POST` · `PUT /{id}` · `DELETE /{id}` | `KnowledgeService.*` |
| Troubleshooting | `POST /troubleshooting:recommend` `{errorCode, description}` | replaces `lib/troubleshoot.ts` |
| Audit | `GET /audit-log?actor&entity&from&to` (restricted) | `AuditService.list` |

Conventions: cursor pagination, ISO-8601 UTC timestamps, RFC 7807 `application/problem+json`
errors, optimistic concurrency via `ETag`/`If-Match` on `PATCH`/`PUT`, idempotency keys on `POST`.
Dashboard/report aggregates should be computed server-side (`GET /reports/...`) at production scale
instead of in the browser as the prototype does.

### Mapping to SAP (indicative — confirm with your SAP team and installed release)
* Production orders / confirmations / work centers → SAP ERP or SAP Digital Manufacturing APIs
  (OData/REST) or IDocs, depending on landscape.
* Incident hand-off to SAP/ITSM → push via the adapter; store the returned `externalRef` on the incident.
* Use a technical user per integration, least privilege, credentials in a secrets vault.

## 3. Authentication

* Corporate **OIDC / SAML SSO** (Azure AD, Okta, SAP IAS, …) with the **authorization-code flow + PKCE**.
  No passwords stored in the app; no tokens in `localStorage` (use in-memory + refresh via BFF, or an
  HttpOnly `SameSite=Lax/Strict` secure session cookie).
* MFA enforced by the IdP. Short-lived access tokens (≤15 min), rotating refresh tokens, idle timeout
  suitable for shared shopfloor terminals (auto-logout, badge login if required).
* Service-to-service: mTLS or OAuth2 client credentials; secrets rotated and never shipped to the client.

## 4. Authorization (RBAC + plant scoping)

Roles in the prototype's `User` type map to IdP groups. Enforce **on the server**; UI hiding is cosmetic.

| Capability | Factory User | MES Support | Production Manager | KB Editor | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| View dashboard / production | own plants | all assigned | all assigned | – | all |
| Create incident | ✔ | ✔ | ✔ | – | ✔ |
| Assign / update / close incident | – | ✔ | ✔ (close) | – | ✔ |
| Shiftbook create / tick tasks | ✔ | ✔ | ✔ | – | ✔ |
| Edit / approve KB articles | – | propose | – | ✔ (approve) | ✔ |
| Reports | – | ✔ | ✔ | – | ✔ |
| Audit log | – | – | – | – | ✔ (read-only) |

* **Plant-level scoping (ABAC):** every query is filtered by the user's permitted factories claim.
* Four-eyes principle for KB approval (author ≠ approver) because approved articles feed the assistant.

## 5. Audit logging

Log every create / update / delete / approval / login / permission failure as an **append-only** record:

```json
{ "ts": "2026-01-01T10:15:00Z", "actor": "user-id", "actorRole": "MES Support", "action": "incident.update",
  "entity": "INC-2410", "factory": "Pune", "before": {"status":"Assigned"}, "after": {"status":"In Progress"},
  "sourceIp": "10.x.x.x", "requestId": "…", "result": "success" }
```

* Store in write-once storage / SIEM; retention per company policy; tamper-evident (hash chaining or WORM).
* The prototype records a simplified version via `audit()` in `services/local.ts` (browser-local, not
  tamper-proof — for demonstration only).
* No secrets or personal data beyond user IDs in log payloads.

## 6. Security checklist

* TLS 1.2+ everywhere; HSTS; strict CSP (no inline scripts), `X-Content-Type-Options`, `frame-ancestors 'none'`.
* Server-side input validation and output encoding (React escapes by default; keep it that way — avoid `dangerouslySetInnerHTML`).
* Validate and allow-list `docLink` URLs (https only, approved domains) before rendering as links.
* Rate limiting, request size limits, dependency scanning (`npm audit`, SCA), SAST in CI.
* GDPR/works-council considerations for user names in shiftbook & audit records.
* Backups, DR targets and monitoring (SLA-engine health, integration lag) defined with operations.

## 7. Troubleshooting assistant in production

The prototype uses deterministic keyword retrieval over **approved** articles and copies steps verbatim.
If an LLM is introduced later, keep these guardrails: retrieval-augmented only from approved articles,
quote and cite the source, return "no confirmed resolution" below a relevance threshold, never present
generated text as an approved resolution, log prompts/answers for audit, and avoid sending sensitive data
to external providers without a data-processing agreement.

## 8. Data persistence in the prototype

`localStorage` keys are prefixed `factorypulse.v1.`; "Reset sample data" in the sidebar clears them.
The sidebar's **Simulate API error** toggle makes every service call fail so error states can be demonstrated.

## 9. SLA notifications

Prototype: browser watcher (`SlaWatcher`) → `POST /api/notify` → `server/notifier.mjs` → SMTP + Teams webhook.
Recipients and secrets are server-side env vars only. **Production:** run the SLA evaluation in a backend scheduler
(it must alert while nobody has the app open), per-plant/per-owner routing (owner mailbox + plant channel),
escalation (e.g. notify the manager at breach), retries with a dead-letter queue, an idempotency key
(`incident:stage:deadline`) so alerts are not duplicated, quiet-hours/on-call rules, secrets in a vault, and every
notification written to the audit log. Prefer Graph/Bot Framework or Workflows over legacy O365 connectors for Teams.
