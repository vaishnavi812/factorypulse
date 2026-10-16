import { useState } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { DEFAULT_FILTERS, FilterCtx, type Filters } from './lib/filters';
import { resetPrototypeData, SIM_ERROR_KEY, services } from './services';
import { cx } from './components/ui';
import Dashboard from './pages/Dashboard';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import Assistant from './pages/Assistant';
import Production from './pages/Production';
import Shiftbook from './pages/Shiftbook';
import Knowledge from './pages/Knowledge';
import Reports from './pages/Reports';
import Notifications, { useUnread } from './pages/Notifications';
import { SlaWatcher } from './components/SlaWatcher';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/incidents', label: 'Incidents', icon: '⚠' },
  { to: '/assistant', label: 'Troubleshooting', icon: '✦' },
  { to: '/production', label: 'Production', icon: '⚙' },
  { to: '/shiftbook', label: 'Shiftbook', icon: '☰' },
  { to: '/knowledge', label: 'Knowledge Center', icon: '❖' },
  { to: '/reports', label: 'Reports', icon: '▤' },
  { to: '/notifications', label: 'SLA Alerts', icon: '🔔' },
];

function SimulateError() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(SIM_ERROR_KEY) === '1'; } catch { return false; } });
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
      <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); try { localStorage.setItem(SIM_ERROR_KEY, e.target.checked ? '1' : '0'); } catch { /* ignore */ } }} />
      Simulate API error
    </label>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const user = services.session.currentUser();
  const unread = useUnread();
  return (
    <FilterCtx.Provider value={{ filters, setFilters }}>
      <div className="min-h-screen lg:flex">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-ink-900 px-4 py-3 text-white lg:hidden">
          <Brand />
          <button aria-label="Toggle navigation" aria-expanded={open} className="rounded p-1.5 text-xl hover:bg-white/10" onClick={() => setOpen(!open)}>☰</button>
        </header>
        <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink-900 text-slate-200 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
          <div className="hidden px-5 py-5 lg:block"><Brand /></div>
          <div className="flex items-center justify-between px-5 py-4 lg:hidden"><span className="text-sm text-slate-400">Menu</span><button aria-label="Close" onClick={() => setOpen(false)}>✕</button></div>
          <nav className="flex-1 space-y-1 px-3" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setOpen(false)}
                className={({ isActive }) => cx('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10')}>
                <span aria-hidden className="w-5 text-center">{n.icon}</span>{n.label}
                {n.to === '/notifications' && unread > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 text-xs text-white">{unread}</span>}
              </NavLink>))}
          </nav>
          <div className="space-y-3 border-t border-white/10 p-4">
            <div className="rounded-md bg-white/5 p-2.5 text-xs">
              <div className="font-medium text-white">{user.name}</div><div className="text-slate-400">{user.role}</div>
              <div className="mt-2 text-amber-300">● Prototype — mock data only.<br />Not connected to SAP or any factory system.</div>
            </div>
            <SimulateError />
            <button className="text-xs text-slate-400 underline hover:text-white" onClick={() => { if (confirm('Reset all sample data to its original state?')) resetPrototypeData(); }}>Reset sample data</button>
          </div>
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:id" element={<IncidentDetail />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/production" element={<Production />} />
            <Route path="/shiftbook" element={<Shiftbook />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <SlaWatcher />
      </div>
    </FilterCtx.Provider>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <div><div className="text-base font-semibold leading-tight text-white">FactoryPulse</div><div className="text-[11px] leading-tight text-slate-400">MES Operations Hub</div></div>
    </div>
  );
}
