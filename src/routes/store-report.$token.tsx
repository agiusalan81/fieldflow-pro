import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STORE_REPORT_CATEGORIES } from "@/lib/store-plaque";
import { STORE_SYMPTOMS, composeProblem } from "@/lib/quick-report";

export const Route = createFileRoute("/store-report/$token")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Report a store problem" },
    { name: "description", content: "Tell the maintenance team about a problem in this store." },
    { property: "og:title", content: "Report a store problem" },
    { property: "og:description", content: "Quick fault and hazard reporting for staff and customers." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: StoreReport,
});

function StoreReport() {
  const { token } = Route.useParams();
  const valid = /^[a-f0-9]{64}$/.test(token);
  const [category, setCategory] = useState("");
  const [symptom, setSymptom] = useState("");
  const [more, setMore] = useState(false);
  const [f, setF] = useState({ name: "", location: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const target = useQuery({ queryKey: ["store-report-target", token], enabled: valid, retry: false, queryFn: async () => {
    const r = await supabase.rpc("get_store_report_target", { _token: token });
    if (r.error) throw r.error;
    const v = r.data as { store?: string; company?: string } | null;
    return v?.store ? { store: v.store, company: v.company ?? "" } : null;
  } });
  const send = async () => {
    if (busy || !category || !target.data) return; setBusy(true); setError("");
    const r = await supabase.rpc("submit_store_problem", { _token: token, _reporter_type: "visitor", _name: f.name.trim(), _category: category, _location: f.location.trim() || target.data.store, _problem: composeProblem({ category, symptom, note: f.note }) });
    setBusy(false);
    if (r.error) setError(r.error.message); else setDone(true);
  };
  const reset = () => { setDone(false); setCategory(""); setSymptom(""); setMore(false); setF({ ...f, location: "", note: "" }); };
  const symptoms = STORE_SYMPTOMS[category] ?? [];
  return <main className="mx-auto max-w-lg px-5 py-8">
    <h1 className="mb-1 text-2xl font-semibold">Report a problem</h1>
    {target.data && <p className="mb-5 text-muted-foreground">{target.data.store}{target.data.company ? ` · ${target.data.company}` : ""}</p>}
    {!valid ? <p role="alert">This reporting link is unavailable.</p> : target.isPending ? <p role="status">Loading…</p> : !target.data ? <p role="alert">This reporting link is unavailable.</p> : done ? <div role="status" className="space-y-3"><h2 className="font-medium">Thank you — report received</h2><p className="text-muted-foreground">Our maintenance team has been told.</p><Button variant="outline" onClick={reset}>Report another problem</Button></div> :
      <div className="space-y-5">
        <fieldset><legend className="mb-2 text-sm font-medium">1. What's the problem?</legend><div className="grid grid-cols-2 gap-2">
          {STORE_REPORT_CATEGORIES.map((c) => <Button key={c} type="button" variant={category === c ? "default" : "outline"} aria-pressed={category === c} className="h-auto min-h-14 whitespace-normal py-3 text-sm" onClick={() => { setCategory(c); setSymptom(""); if (c === "Other") setMore(true); }}>{c}</Button>)}
        </div></fieldset>
        {category && symptoms.length > 0 && <fieldset><legend className="mb-2 text-sm font-medium">2. Tap one (optional)</legend><div className="flex flex-wrap gap-2">
          {symptoms.map((s) => <Button key={s} type="button" size="sm" variant={symptom === s ? "default" : "outline"} aria-pressed={symptom === s} className="h-10 rounded-full" onClick={() => setSymptom(symptom === s ? "" : s)}>{s}</Button>)}
        </div></fieldset>}
        {category && !more && <button type="button" className="text-sm text-primary underline" onClick={() => setMore(true)}>Add details (optional)</button>}
        {category && more && <div className="space-y-3 rounded-lg border p-3">
          <div><Label htmlFor="sr-loc">Where exactly? (optional)</Label><Input id="sr-loc" className="h-11" maxLength={200} placeholder="e.g. Aisle 3 near dairy" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div><Label htmlFor="sr-problem">Note (optional)</Label><Textarea id="sr-problem" maxLength={1500} rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <div><Label htmlFor="sr-name">Your name (optional)</Label><Input id="sr-name" className="h-11" maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        </div>}
        <p className="text-xs text-muted-foreground">For emergencies, tell a member of staff straight away.</p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button className="h-12 w-full" disabled={busy || !category} onClick={send}>{busy ? "Sending…" : "Send report"}</Button>
      </div>}
  </main>;
}
