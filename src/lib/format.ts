export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
export const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

export function relTime(targetIso: string, now = Date.now()): string {
  const diff = new Date(targetIso).getTime() - now;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const text = m < 60 ? `${m}m` : m < 60 * 48 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.round(m / 1440)}d`;
  return diff < 0 ? `${text} ago` : `in ${text}`;
}
export const fmtHours = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);
export const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
