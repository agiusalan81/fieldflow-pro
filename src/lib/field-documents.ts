export const TECH_FIELDS = ['trade', 'manufacturer', 'model', 'subsystem', 'documentType', 'revision', 'language'] as const;
export const DEFAULT_TECH_STRUCTURE = {
  labels: { trade: 'Trade / system', manufacturer: 'Manufacturer', model: 'Model / family', subsystem: 'Subsystem / component', documentType: 'Document type', revision: 'Revision', language: 'Language' },
  options: { trade: [], manufacturer: [], model: [], subsystem: [], documentType: ['Manual', 'Schematic', 'Technical bulletin', 'S.O.P. / Safety Procedure'], revision: [], language: [] } as Record<string, string[]>,
  tags: ['Fault codes', 'Programming', 'Schematics', 'Maintenance', 'Parts', 'Technical bulletins', 'Commissioning', 'Safety procedures'],
};
export type TechStructure = typeof DEFAULT_TECH_STRUCTURE;
/** Guidance and one-tap suggestions shown beside each Technical data structure field. */
export const TECH_GUIDE: Record<string, { hint: string; suggestions: string[] }> = {
  trade: { hint: 'The main discipline a document belongs to.', suggestions: ['Lifts', 'Escalators', 'HVAC', 'Electrical', 'Plumbing', 'Drains', 'Fire & Security'] },
  manufacturer: { hint: 'Brands of equipment your team services.', suggestions: ['Otis', 'Schindler', 'Kone', 'TK Elevator', 'Orona', 'Wittur', 'Mitsubishi', 'Fermator'] },
  model: { hint: 'Model or controller family, so technicians find the exact manual.', suggestions: ['Gen2', 'MonoSpace', '3300', '5500', 'Synergy', 'Arca II'] },
  subsystem: { hint: 'The part of the equipment the document covers.', suggestions: ['Controller', 'Drive / inverter', 'Door operator', 'Safety gear / governor', 'Hydraulic unit', 'Car operating panel (COP)', 'Landing push buttons (LOP)', 'Machine / motor'] },
  documentType: { hint: 'What kind of document it is.', suggestions: ['Manual', 'Schematic', 'Technical bulletin', 'S.O.P. / Safety Procedure', 'Fault code guide', 'Parts catalogue', 'Commissioning guide'] },
  revision: { hint: 'Edition, so old and new versions are not mixed up.', suggestions: ['Rev A', 'Rev B', 'Rev C', 'Latest', 'Obsolete'] },
  language: { hint: 'Language the document is written in.', suggestions: ['English', 'Maltese', 'Italian', 'German', 'Spanish', 'French'] },
  tags: { hint: 'Topics inside a document; technicians tick these to jump to the right pages.', suggestions: ['Fault codes', 'Programming', 'Schematics', 'Maintenance', 'Parts', 'Commissioning', 'Safety procedures', 'Adjustments'] },
};
/** Adds a suggestion to a comma-separated list unless already present (case-insensitive). */
export function addChoice(list: string, item: string) {
  const parts = list.split(',').map(x => x.trim()).filter(Boolean);
  return parts.some(p => p.toLowerCase() === item.toLowerCase()) ? parts.join(', ') : [...parts, item].join(', ');
}
export function technicalStructure(raw: unknown): TechStructure {
  const r = raw && typeof raw === 'object' ? raw as Partial<TechStructure> : {};
  return { labels: { ...DEFAULT_TECH_STRUCTURE.labels, ...r.labels }, options: { ...DEFAULT_TECH_STRUCTURE.options, ...r.options }, tags: Array.isArray(r.tags) ? r.tags : DEFAULT_TECH_STRUCTURE.tags };
}
export function canPublishTechnical(role?: string, displayedRole: string | undefined = role) { return (role === 'superuser' || role === 'supervisor') && (displayedRole === 'superuser' || displayedRole === 'supervisor'); }
export function canReadTechnical(role: string, d: { status: string; restricted: boolean; uploaded_by: string }, userId: string) {
  return ['superuser','supervisor','admin'].includes(role) || (!d.restricted && (d.status === 'approved' || (d.status === 'pending' && d.uploaded_by === userId)));
}
export function printPages(range: string, count: number): number[] {
  const result = new Set<number>();
  for (const part of range.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Enter pages such as 1-3, 7.');
    const start=Number(match[1]),end=Number(match[2] ?? match[1]);
    if(start<1 || end<start || end>count) throw new Error(`Choose pages between 1 and ${count}.`);
    for(let i=start;i<=end;i++) result.add(i);
  }
  return [...result].sort((a,b)=>a-b);
}
export type IndexedPage = { page: number; text: string };
export function relevantPages(docs: { id: string; title: string; pages: IndexedPage[] }[], query: string) {
  const terms = query.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(t=>t.length>1) ?? [];
  return docs.flatMap(d=>d.pages.map(p=>({documentId:d.id,title:d.title,page:p.page,text:p.text,score:terms.reduce((s,t)=>s+(p.text.toLowerCase().includes(t)?1:0),0)})))
    .filter(p=>p.score>0 && p.text.trim()).sort((a,b)=>b.score-a.score).slice(0,16);
}
export function shouldShareLocation(consent: boolean, shift: { ended_at: string | null } | undefined) { return consent && !!shift && shift.ended_at === null; }
export function locationIsFresh(recordedAt: string, now: number) { return now - new Date(recordedAt).getTime() < 120000; }

export function missingPayrollMembers<T extends {id:string;registration_status:string}>(members:T[], configured:{user_id:string}[]) { return members.filter(m=>m.registration_status === "active" && !configured.some(s=>s.user_id===m.id)); }
