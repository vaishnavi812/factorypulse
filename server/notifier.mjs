// Local SLA notifier: sends email (SMTP) and Microsoft Teams (incoming webhook / Workflows) alerts.
// Secrets and recipients come from environment variables ONLY — never from the browser — so the
// endpoint cannot be abused as an open mail relay. Without configuration it runs in dry-run mode.
import http from 'node:http';
import { appendFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';

const { PORT = '8787', SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, SMTP_SECURE, ALERT_EMAIL_FROM, ALERT_EMAIL_TO, TEAMS_WEBHOOK_URL, APP_URL = 'http://localhost:5173' } = process.env;

const emailOn = !!(SMTP_HOST && ALERT_EMAIL_FROM && ALERT_EMAIL_TO);
const teamsOn = !!TEAMS_WEBHOOK_URL;
const transport = emailOn ? nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: SMTP_SECURE === 'true', auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined }) : null;

const KINDS = { 'at-risk': { icon: '⏱', label: 'SLA AT RISK', color: 'Warning' }, breached: { icon: '🚨', label: 'SLA BREACHED', color: 'Attention' } };
const str = (v, max = 300) => String(v ?? '').slice(0, max);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function compose(kind, i) {
  const k = KINDS[kind];
  const link = `${APP_URL}/#/incidents/${encodeURIComponent(i.id)}`;
  const subject = `${k.icon} ${k.label}: ${i.id} (${i.priority}) – ${i.factory}`;
  const facts = [['Incident', i.id], ['Priority', i.priority], ['Factory', i.factory], ['Work center', i.workCenter], ['Application', i.application], ['Error', i.errorCode], ['Owner', i.owner], ['Status', i.status], ['SLA deadline', i.slaDeadline]];
  const text = `${subject}\n\n${i.description}\n\n${facts.map(([a, b]) => `${a}: ${b}`).join('\n')}\n\nOpen: ${link}`;
  const html = `<h3>${esc(subject)}</h3><p>${esc(i.description)}</p><table cellpadding="4">${facts.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join('')}</table><p><a href="${esc(link)}">Open incident</a></p>`;
  const card = { type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
    body: [{ type: 'TextBlock', text: subject, weight: 'Bolder', size: 'Medium', color: k.color, wrap: true }, { type: 'TextBlock', text: i.description, wrap: true },
      { type: 'FactSet', facts: facts.map(([title, value]) => ({ title, value })) }],
    actions: [{ type: 'Action.OpenUrl', title: 'Open incident', url: link }] } }] };
  return { subject, text, html, card };
}

async function deliver(kind, inc) {
  const m = compose(kind, inc);
  const res = { email: 'skipped', teams: 'skipped' };
  if (emailOn) { try { await transport.sendMail({ from: ALERT_EMAIL_FROM, to: ALERT_EMAIL_TO, subject: m.subject, text: m.text, html: m.html }); res.email = 'sent'; } catch (e) { res.email = `failed: ${e.message}`; } }
  if (teamsOn) { try { const r = await fetch(TEAMS_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m.card) }); res.teams = r.ok ? 'sent' : `failed: HTTP ${r.status}`; } catch (e) { res.teams = `failed: ${e.message}`; } }
  if (!emailOn && !teamsOn) { res.email = res.teams = 'dry-run'; console.log(`[dry-run] ${m.subject}`); }
  await appendFile(new URL('./outbox.log', import.meta.url), JSON.stringify({ at: new Date().toISOString(), kind, id: inc.id, subject: m.subject, res }) + '\n').catch(() => {});
  return res;
}

const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/notify/status') return send(res, 200, { email: emailOn, teams: teamsOn, dryRun: !emailOn && !teamsOn });
  if (req.method === 'POST' && url.pathname === '/api/notify') {
    let raw = ''; for await (const c of req) { raw += c; if (raw.length > 20_000) return send(res, 413, { error: 'too large' }); }
    try {
      const { kind, incident: x } = JSON.parse(raw);
      if (!KINDS[kind] || !x || typeof x.id !== 'string') return send(res, 400, { error: 'invalid payload' });
      const inc = Object.fromEntries(['id', 'priority', 'factory', 'workCenter', 'application', 'errorCode', 'owner', 'status', 'slaDeadline', 'description'].map((f) => [f, str(x[f])]));
      return send(res, 200, await deliver(kind, inc));
    } catch { return send(res, 400, { error: 'bad json' }); }
  }
  send(res, 404, { error: 'not found' });
}).listen(Number(PORT), '127.0.0.1', () => console.log(`FactoryPulse notifier on http://127.0.0.1:${PORT} — email: ${emailOn ? 'ON' : 'off'}, teams: ${teamsOn ? 'ON' : 'off'}${!emailOn && !teamsOn ? ' (DRY-RUN)' : ''}`));
