import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {technicalStructure,TECH_FIELDS} from '@/lib/field-documents';
import {technicalSuggestions} from '@/lib/technical-suggestions';
import {useCompanyRules} from '@/lib/company';
import {useEdition,usePlanFeatures} from '@/lib/plan-features';
import {SuggestionChips} from '@/components/suggestion-chips';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import type {Json} from '@/integrations/supabase/types';

const toList=(s:string)=>s.split(',').map(x=>x.trim()).filter(Boolean);
type Draft={labels:Record<string,string>;options:Record<string,string>;tags:string};

export function TechnicalStructure({companyId}:{companyId:string}){
  const {data:company}=useCompanyRules(); const {edition}=useEdition(); const plan=usePlanFeatures();
  const guide=technicalSuggestions(edition,company?.industry??'',company?.trades??[],plan('lift_pack'));
  const qc=useQueryClient();
  const q=useQuery({queryKey:['technical-structure',companyId],queryFn:async()=>{const r=await supabase.from('company_settings').select('technical_structure').eq('company_id',companyId).single();if(r.error)throw r.error;return technicalStructure(r.data.technical_structure);}});
  const[draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(false);
  const base=q.data;
  if(!base)return <p>{q.error?.message??'Loading…'}</p>;
  // Raw text is kept while typing so commas and cursor position are preserved; lists are parsed on save.
  const value:Draft=draft??{labels:{...base.labels},options:Object.fromEntries(TECH_FIELDS.map(f=>[f,(base.options[f]??[]).join(', ')])),tags:base.tags.join(', ')};
  const save=async()=>{setBusy(true);try{const next={labels:value.labels,options:Object.fromEntries(TECH_FIELDS.map(f=>[f,toList(value.options[f]??'')])),tags:toList(value.tags)};const r=await supabase.from('company_settings').update({technical_structure:next as unknown as Json}).eq('company_id',companyId);if(r.error)throw r.error;await qc.invalidateQueries({queryKey:['technical-structure']});setDraft(null);toast.success('Technical data structure saved');}catch(e){toast.error(e instanceof Error?e.message:'Could not save');}finally{setBusy(false);}};
  const g=(f:string)=>guide[f]??{hint:'',suggestions:[]};
  return <div className="space-y-5"><h2 className="font-medium">Technical data structure setup</h2>
    <div className="rounded-lg border bg-muted/40 p-4 text-sm"><p className="font-medium">How this works</p><p className="text-muted-foreground">When manuals, schematics or bulletins are added to your technical library, they are tagged with these choices. Technicians then filter by them on site to find the right document fast. Rename a field title if you prefer your own wording, and tap a suggestion to add it — or type your own, separated by commas. Every field is optional.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">{TECH_FIELDS.map(f=><div key={f} className="space-y-2 border-b pb-3"><Label htmlFor={`label-${f}`}>{value.labels[f]} · field title</Label><p className="text-xs text-muted-foreground">{g(f).hint}</p><Input id={`label-${f}`} value={value.labels[f]??''} onChange={e=>setDraft({...value,labels:{...value.labels,[f]:e.target.value}})}/><Label htmlFor={`options-${f}`}>Choices (comma separated)</Label><Input id={`options-${f}`} placeholder={`e.g. ${g(f).suggestions.slice(0,3).join(', ')}`} value={value.options[f]??''} onChange={e=>setDraft({...value,options:{...value.options,[f]:e.target.value}})}/><SuggestionChips value={value.options[f]??''} suggestions={g(f).suggestions} onChange={next=>setDraft({...value,options:{...value.options,[f]:next}})}/></div>)}</div>
    <Label htmlFor="tech-tags">Document contents checklist (comma separated)</Label><p className="text-xs text-muted-foreground">{g('tags').hint}</p><Input id="tech-tags" value={value.tags} onChange={e=>setDraft({...value,tags:e.target.value})}/><SuggestionChips value={value.tags} suggestions={g('tags').suggestions} onChange={next=>setDraft({...value,tags:next})}/><Button disabled={busy} onClick={save}>Save structure</Button></div>;
}
