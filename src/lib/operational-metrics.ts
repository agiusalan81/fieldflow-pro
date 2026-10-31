export type MetricReport = { created_at: string | null; closed_at: string | null; status: string; key: string; label: string };
export function reportMetrics(reports: MetricReport[], start: string, end: string) {
  const rows = reports.filter(r => !!r.created_at && r.created_at >= start && r.created_at < end);
  const timed = rows.filter(r => r.status === 'closed' && r.closed_at && r.created_at && r.closed_at >= r.created_at);
  const groups = new Map<string, { label: string; count: number }>();
  for (const row of rows) { const group = groups.get(row.key) ?? { label: row.label, count: 0 }; group.count++; groups.set(row.key, group); }
  return { received: rows.length, closed: rows.filter(r => r.status === 'closed').length, open: rows.filter(r => r.status === 'open').length,
    closureHours: timed.length ? timed.reduce((n, r) => n + (Date.parse(r.closed_at ?? '') - Date.parse(r.created_at ?? '')) / 3600000, 0) / timed.length : null,
    timedCount: timed.length, hotspots: [...groups.values()].filter(g => g.count > 1).sort((a,b) => b.count-a.count).slice(0,5) };
}
export function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid month');
  const [year, number] = month.split('-').map(Number);
  if (!year || !number || year < 2000 || year > 2100) throw new Error('Choose a valid month');
  return { start: `${month}-01T00:00:00.000Z`, end: new Date(Date.UTC(year, number, 1)).toISOString() };
}
export function metricsCsv(rows: [string,string | number][]) {
  const cell = (value: string | number) => { const text = String(value); return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"','""')}"`; };
  return '\uFEFF' + [['Metric','Value'], ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
export function quoteDecisionMetrics(statuses:string[]) {
  const decisions=statuses.filter(s=>s==='accepted'||s==='declined');
  return {decisions:decisions.length,accepted:decisions.filter(s=>s==='accepted').length};
}