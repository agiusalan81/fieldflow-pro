/** Stable comparison ignores object-key order, not meaningful values or row order. */
export function sheetFingerprint(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(sheetFingerprint).join(',')}]`;
 if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>`${JSON.stringify(key)}:${sheetFingerprint(v)}`).join(',')}}`;
 return JSON.stringify(value)??'null';
}
