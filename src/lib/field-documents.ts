export const TECH_FIELDS = ['trade', 'manufacturer', 'model', 'subsystem', 'documentType', 'revision', 'language'] as const;
export const DEFAULT_TECH_STRUCTURE = {
  labels: { trade: 'Trade / system', manufacturer: 'Manufacturer', model: 'Model / family', subsystem: 'Subsystem / component', documentType: 'Document type', revision: 'Revision', language: 'Language' },
  options: { trade: [], manufacturer: [], model: [], subsystem: [], documentType: ['Manual', 'Schematic', 'Technical bulletin', 'S.O.P. / Safety Procedure'], revision: [], language: [] } as Record<string, string[]>,
  tags: ['Fault codes', 'Programming', 'Schematics', 'Maintenance', 'Parts', 'Technical bulletins', 'Commissioning', 'Safety procedures'],
};
export type TechStructure = typeof DEFAULT_TECH_STRUCTURE;
export function technicalStructure(raw: unknown): TechStructure {
  const r = raw && typeof raw === 'object' ? raw as Partial<TechStructure> : {};
  return { labels: { ...DEFAULT_TECH_STRUCTURE.labels, ...r.labels }, options: { ...DEFAULT_TECH_STRUCTURE.options, ...r.options }, tags: Array.isArray(r.tags) ? r.tags : DEFAULT_TECH_STRUCTURE.tags };
}
export function canPublishTechnical(role?: string) { return role === 'superuser' || role === 'supervisor'; }
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
