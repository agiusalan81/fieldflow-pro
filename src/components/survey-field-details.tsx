import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addSurveyTrade, groupSurveyObservations, surveyTradeOptions, surveyTradeLabel, type SurveyDetails, type SurveyObservation, type TradeReview } from "@/lib/survey-details";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isLiftTrade } from '@/lib/trade-association';

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-foreground";

export function SurveyContacts({ details, onChange }: { details: SurveyDetails; onChange: (value: SurveyDetails) => void }) {
  const patch = (id: string, key: "name" | "position" | "email" | "phone", value: string) => onChange({ ...details, contacts: details.contacts.map(c => c.id === id ? { ...c, [key]: value } : c) });
  return <section className="space-y-3">
    <h2 className="font-medium">Contact persons</h2>
    {details.contacts.map((c, i) => <div key={c.id} className="grid min-w-0 gap-3 border-b pb-3 sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center justify-between"><span className="text-sm text-muted-foreground">Contact {i + 1}</span><Button type="button" size="icon" variant="ghost" aria-label={`Remove contact ${i + 1}`} onClick={() => onChange({ ...details, contacts: details.contacts.filter(x => x.id !== c.id) })}><Trash2 className="h-4 w-4" /></Button></div>
      <div><Label htmlFor={`contact-${c.id}-name`}>Contact person</Label><Input id={`contact-${c.id}-name`} value={c.name} onChange={e => patch(c.id, "name", e.target.value)} /></div>
      <div><Label htmlFor={`contact-${c.id}-position`}>Position</Label><Input id={`contact-${c.id}-position`} list="survey-contact-positions" value={c.position} onChange={e => patch(c.id, "position", e.target.value)} /></div>
      <div><Label htmlFor={`contact-${c.id}-email`}>Email</Label><Input id={`contact-${c.id}-email`} type="email" value={c.email} onChange={e => patch(c.id, "email", e.target.value)} /></div>
      <div><Label htmlFor={`contact-${c.id}-phone`}>Phone</Label><Input id={`contact-${c.id}-phone`} type="tel" value={c.phone} onChange={e => patch(c.id, "phone", e.target.value)} /></div>
    </div>)}
    <datalist id="survey-contact-positions">{["Owner", "Facilities manager", "Site manager", "Caretaker", "Tenant", "Operations manager"].map(p => <option key={p} value={p} />)}</datalist>
    <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...details, contacts: [...details.contacts, { id: crypto.randomUUID(), name: "", position: "", email: "", phone: "" }] })}><Plus className="mr-1 h-4 w-4" />Add contact person</Button>
  </section>;
}

export function SurveyTrades({ details, companyTrades, onChange }: { details: SurveyDetails; companyTrades: string[]; onChange: (value: SurveyDetails) => void }) {
  const [other, setOther] = useState("");
  const options = surveyTradeOptions(companyTrades);
  const toggle = (trade: string, checked: boolean) => onChange({ ...details, trades: checked ? addSurveyTrade(details.trades, trade) : details.trades.filter(t => t !== trade) });
  return <section className="space-y-3">
    <h2 className="font-medium">Trades involved</h2>
    <div className="grid gap-2 sm:grid-cols-2">{options.map(t => <label key={t.key} className="flex items-center gap-2 text-sm"><Checkbox checked={details.trades.includes(t.key)} onCheckedChange={v => toggle(t.key, v === true)} />{t.label}</label>)}
      {details.trades.filter(t => !options.some(o => o.key === t)).map(t => <label key={t} className="flex items-center gap-2 text-sm"><Checkbox checked onCheckedChange={() => toggle(t, false)} />{surveyTradeLabel(t)}</label>)}
    </div>
    <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><Label htmlFor="survey-other-trade">Other trade</Label><Input id="survey-other-trade" placeholder="e.g. Pool maintenance, solar, cleaning" value={other} onChange={e => setOther(e.target.value)} /></div><Button type="button" variant="outline" disabled={!other.trim()} onClick={() => { onChange({ ...details, trades: addSurveyTrade(details.trades, other) }); setOther(""); }}><Plus className="mr-1 h-4 w-4" />Add trade</Button></div>
  </section>;
}

function ObservationPhotos({ companyId, surveyId, observation, disabled, onChange }: { companyId: string; surveyId: string; observation: SurveyObservation; disabled: boolean; onChange: (photos: string[]) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const paths = observation.photos ?? [];
  const urls = useQuery({ queryKey: ["survey-observation-photos", companyId, ...paths], enabled: paths.length > 0, queryFn: async () => { const r = await supabase.storage.from("job-photos").createSignedUrls(paths, 3600); if (r.error) throw r.error; return Object.fromEntries((r.data ?? []).flatMap(p => p.path && p.signedUrl ? [[p.path, p.signedUrl]] : [])); } });
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    try {
      for (const f of Array.from(files)) {
        const bitmap = await createImageBitmap(f);
        const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Photo could not be prepared");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.8)); if (!blob) throw new Error("Photo could not be prepared");
        const path = `${companyId}/site-surveys/${surveyId}/${crypto.randomUUID()}.jpg`;
        const r = await supabase.storage.from("job-photos").upload(path, blob, { contentType: "image/jpeg" }); if (r.error) throw r.error;
        added.push(path);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Photo upload failed"); }
    finally { if (added.length) onChange([...paths, ...added]); setBusy(false); if (file.current) file.current.value = ""; }
  };
  return <div className="flex flex-wrap gap-2">
    {paths.map((path, i) => <div key={path} className="flex flex-col gap-1">{urls.data?.[path] && <Button type="button" variant="ghost" className="h-20 w-20 p-0" aria-label={`View observation photo ${i + 1}`} onClick={() => setView(urls.data?.[path] ?? null)}><img src={urls.data[path]} alt="Site observation" className="h-20 w-20 rounded-md object-cover" /></Button>}{!disabled && <Button type="button" variant="ghost" size="sm" aria-label={`Remove observation photo ${i + 1}`} onClick={() => onChange(paths.filter(p => p !== path))}><Trash2 className="h-4 w-4" /></Button>}</div>)}
    {!disabled && <><input ref={file} aria-label="Upload survey photos" type="file" accept="image/*" multiple className="hidden" onChange={e => void upload(e.target.files)} /><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => file.current?.click()}><Camera className="mr-1 h-4 w-4" />{busy ? "Uploading…" : "Add photos"}</Button><input ref={camera} aria-label="Take survey photo" type="file" accept="image/*" capture="environment" disabled={busy} className="hidden" onChange={e => { void upload(e.target.files); e.target.value = ''; }} /><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => camera.current?.click()}><Camera className="mr-1 h-4 w-4" />Take photo</Button></>}
    {view && <div role="dialog" aria-label="Observation photo" className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-5" onClick={() => setView(null)}><img src={view} alt="Site observation enlarged" className="max-h-full max-w-full" /><Button type="button" className="absolute right-5 top-5" onClick={() => setView(null)}>Close</Button></div>}
  </div>;
}

export function SurveyObservations({ details, onChange, disabled, companyId, surveyId, liftPack = false }: { details: SurveyDetails; onChange: (value: SurveyDetails) => void; disabled: boolean; companyId: string; surveyId: string; liftPack?: boolean }) {
  const patch = (id: string, p: Partial<SurveyObservation>) => onChange({ ...details, observations: details.observations.map(o => o.id === id ? { ...o, ...p } : o) });
  return <section className="space-y-4">
    <h2 className="font-medium">Room / area observations <span className="text-xs font-normal text-muted-foreground">(optional)</span></h2>
    {groupSurveyObservations(details).map(g => <section key={g.trade} className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-semibold">{g.label}</h3>
      {g.observations.map((o, i) => <div key={o.id} className="space-y-2 rounded-md border bg-card p-3">
        <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Label htmlFor={`area-${o.id}`}>Room / area</Label><Input id={`area-${o.id}`} value={o.area} onChange={e => patch(o.id, { area: e.target.value })} /></div>{!disabled && <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${g.label} observation ${i + 1}`} onClick={() => onChange({ ...details, observations: details.observations.filter(x => x.id !== o.id) })}><Trash2 className="h-4 w-4" /></Button>}</div>
        {!disabled && liftPack && (isLiftTrade(o.trade) || (!o.trade && details.trades.some(isLiftTrade))) && <div className="flex flex-wrap gap-1">{['Lift pit', 'Machine room', 'Lift well', 'Car / cabin', 'Landing doors', 'Lift lobby', 'Headroom'].map(area => <Button key={area} type="button" variant="outline" size="sm" className="h-auto whitespace-normal py-1 text-xs" onClick={() => patch(o.id, { area })}>{area}</Button>)}</div>}
        <div><Label htmlFor={`finding-${o.id}`}>Findings / work needed</Label><Textarea id={`finding-${o.id}`} value={o.notes} onChange={e => patch(o.id, { notes: e.target.value })} /></div>
        <div className="grid gap-2 sm:grid-cols-2"><div><Label htmlFor={`trade-${o.id}`}>Trade / category</Label><select id={`trade-${o.id}`} className={selectClass} value={o.trade} onChange={e => patch(o.id, { trade: e.target.value })}><option value="">General / site</option>{details.trades.map(t => <option key={t} value={t}>{surveyTradeLabel(t)}</option>)}</select></div><div><Label htmlFor={`urgency-${o.id}`}>Defect urgency</Label><select id={`urgency-${o.id}`} className={selectClass} value={o.urgency ?? 'routine'} onChange={e => patch(o.id, { urgency: e.target.value })}><option value="routine">Routine / area record</option><option value="soon">Repair needed</option><option value="urgent">Urgent defect</option></select></div></div>
        <div><Label htmlFor={`caption-${o.id}`}>Photo caption</Label><Input id={`caption-${o.id}`} value={o.caption ?? ''} onChange={e => patch(o.id, { caption: e.target.value })} /></div>
        <ObservationPhotos companyId={companyId} surveyId={surveyId} observation={o} disabled={disabled} onChange={photos => patch(o.id, { photos })} />
      </div>)}
      {!disabled && <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...details, observations: [...details.observations, { id: crypto.randomUUID(), area: "", trade: g.trade, notes: "", photos: [] }] })}><Plus className="mr-1 h-4 w-4" />Add {g.label} observation</Button>}
    </section>)}
    {!disabled && <Button type="button" variant="outline" className="h-auto whitespace-normal py-2" onClick={() => onChange({ ...details, observations: [...details.observations, { id: crypto.randomUUID(), area: '', trade: '', notes: '', photos: [] }] })}><Plus className="mr-1 h-4 w-4" />Add room / area observation</Button>}
  </section>;
}

export function SurveyTradeReview({ details, review, onChange }: { details: SurveyDetails; review: TradeReview; onChange: (value: TradeReview) => void }) {
  if (!details.trades.length) return null;
  return <section className="space-y-3 border-t pt-4"><h2 className="font-medium">Trade handling</h2>{details.trades.map(trade => <div key={trade} className="grid gap-2 sm:grid-cols-2"><div><Label htmlFor={`handling-${trade}`}>{surveyTradeLabel(trade)}</Label><select id={`handling-${trade}`} className={selectClass} value={review[trade]?.decision ?? ""} onChange={e => onChange({ ...review, [trade]: { notes: review[trade]?.notes ?? "", decision: e.target.value as TradeReview[string]["decision"] } })}><option value="">Choose handling…</option><option value="in_house">In-house team</option><option value="subcontract">Subcontract</option><option value="exclude">Exclude / client responsibility</option></select></div><div><Label htmlFor={`handling-note-${trade}`}>Internal notes</Label><Input id={`handling-note-${trade}`} value={review[trade]?.notes ?? ""} onChange={e => onChange({ ...review, [trade]: { decision: review[trade]?.decision ?? "", notes: e.target.value } })} /></div></div>)}</section>;
}