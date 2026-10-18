import { splitHours, type OvertimeRules } from './jobsheets';
export type OvertimeReport = {id:string;shift_id:string|null;report_date:string;ot15_hours:number;ot20_hours:number;rows:unknown;overtime_rules:unknown};
export function overtimeDetails(reports:OvertimeReport[],rate:'ot15'|'ot20'){
 const seen=new Set<string>();
 return reports.filter(r=>{const key=r.shift_id??r.id;if(seen.has(key))return false;seen.add(key);return Number(rate==='ot15'?r.ot15_hours:r.ot20_hours)>0;}).map(r=>{
 const rules=r.overtime_rules as OvertimeRules|null;
 const verified=!!rules && Array.isArray(rules.work_days)&&Array.isArray(rules.public_holidays)&&typeof rules.work_start==='string'&&typeof rules.work_end==='string';
 const activities=Array.isArray(r.rows)?r.rows.flatMap((v:unknown)=>{
 if(!v || typeof v!=='object')return [];const row=v as Record<string,unknown>;
 if(row.kind==='break' || typeof row.title!=='string' || typeof row.place!=='string')return [];
 const from=typeof row.from==='string'?row.from:'',to=typeof row.to==='string'?row.to:'';
 const hours=verified && rules && /^\d\d:\d\d$/.test(from)&&/^\d\d:\d\d$/.test(to)&&from!==to?splitHours(r.report_date,from,to,rules)[rate]:null;
 if(hours===0)return [];
 return [{title:row.title,place:row.place||'No site recorded',from,to,hours}];
 }):[];
 return {id:r.id,date:r.report_date,hours:Number(rate==='ot15'?r.ot15_hours:r.ot20_hours),verified,activities};
 });
}
