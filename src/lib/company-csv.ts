import Papa from 'papaparse';
export type ImportKind = 'clients' | 'sites' | 'equipment' | 'rooms';
export const IMPORT_FIELDS: Record<ImportKind,string[]> = {
  clients: ['name','address'], sites: ['client','name','address','store_code'],
  equipment: ['client','site','reference','category','location','serial'], rooms: ['client','site','reference','location'],
};
export const REQUIRED_FIELDS: Record<ImportKind,string[]> = { clients: ['name'], sites: ['client','name'], equipment: ['client','site','reference','category'], rooms: ['client','site','reference'] };
export function parseCompanyCsv(text: string) {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/,''), { skipEmptyLines: 'greedy' });
  if (result.errors.length) throw new Error(`CSV could not be read: ${result.errors[0]?.message}`);
  const [headers, ...rows] = result.data;
  if (!headers?.length || !rows.length) throw new Error('Choose a CSV containing headings and at least one row');
  if (rows.length > 1000) throw new Error('Import up to 1000 rows at a time');
  if (new Set(headers.map(h=>h.trim().toLowerCase())).size !== headers.length) throw new Error('Column headings must be unique');
  if (rows.some(r=>r.length!==headers.length)) throw new Error('Every row must have the same number of columns as the headings');
  return { headers: headers.map(h=>h.trim()), rows };
}
export function mappedImportRows(kind: ImportKind, rows: string[][], mapping: Record<string,number>) {
  const errors: string[] = []; const seen = new Set<string>();
  const records = rows.map((row,i)=>{
    const record = Object.fromEntries(IMPORT_FIELDS[kind].map(field=>[field,(row[mapping[field] ?? -1] ?? '').trim()]));
    for (const field of REQUIRED_FIELDS[kind]) if (!record[field]) errors.push(`Row ${i+2}: ${field} is required`);
    for (const [field,value] of Object.entries(record)) if(value.length > (field==='address'||field==='location'?500:200)) errors.push(`Row ${i+2}: ${field} is too long`);
    const key = (kind==='clients' ? record['name'] : kind==='sites' ? `${record['client']}|${record['name']}` : record['reference'])?.toLowerCase() ?? '';
    if (seen.has(key)) errors.push(`Row ${i+2}: duplicate ${kind==='equipment'||kind==='rooms'?'ID':'name'} in this file`); seen.add(key);
    return record;
  });
  return { records, errors };
}
export function csvTemplate(kind: ImportKind) { return Papa.unparse([IMPORT_FIELDS[kind] ?? []]); }