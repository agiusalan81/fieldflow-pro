import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STORE_REPORT_CATEGORIES } from "@/lib/store-plaque";

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

const sel = "h-11 w-full rounded-md border bg-background px-3 text-foreground";

function StoreReport() {
  const { token } = Route.useParams();
  const valid = /^[a-f0-9]{64}$/.test(token);
  const [f, setF] = useState({ type: "staff" as "staff" | "visitor", name: "", category: "", location: "", problem: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const target = useQuery({ queryKey: ["store-report-target", token], enabled: valid, retry: false, queryFn: async () => {
    const r = await supabase.rpc("get_store_report_target", { _token: token });
    if (r.error) throw r.error;
    const v = r.data as { store?: string; company?: string } | null;
    return v?.store ? { store: v.store, company: v.company ?? "" } : null;
  } });
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    const r = await supabase.rpc("submit_store_problem", { _token: token, _reporter_type: f.type, _name: f.name.trim(), _category: f.category, _location: f.location.trim(), _problem: f.problem.trim() });
    setBusy(false);
    if (r.error) setError(r.error.message); else setDone(true);
  };
  return <main className="mx-auto max-w-lg px-5 py-10">
    <h1 className="mb-1 text-2xl font-semibold">Report a problem</h1>
    {target.data && <p className="mb-6 text-muted-foreground">{target.data.store}{target.data.company ? ` · ${target.data.company}` : ""}</p>}
    {!valid ? <p role="alert">This reporting link is unavailable.</p> : target.isPending ? <p role="status">Loading…</p> : !target.data ? <p role="alert">This reporting link is unavailable.</p> : done ? <div role="status" className="space-y-3"><h2 className="font-medium">Thank you — report received</h2><p className="text-muted-foreground">Our maintenance team has been told.</p><Button variant="outline" onClick={() => { setDone(false); setF({ ...f, category: "", location: "", problem: "" }); }}>Report another problem</Button></div> :
      <form onSubmit={send} className="space-y-4">
        <fieldset><legend className="mb-2 text-sm font-medium">I am</legend><div className="grid grid-cols-2 gap-2">
          {([["staff", "Store staff"], ["visitor", "A customer / visitor"]] as const).map(([k, v]) => <Button key={k} type="button" variant={f.type === k ? "default" : "outline"} className="h-11" aria-pressed={f.type === k} onClick={() => setF({ ...f, type: k })}>{v}</Button>)}
        </div></fieldset>
        <div><Label htmlFor="sr-name">{f.type === "staff" ? "Your name" : "Your name (optional)"}</Label><Input id="sr-name" className="h-11" required={f.type === "staff"} maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label htmlFor="sr-cat">What kind of problem?</Label><select id="sr-cat" required className={sel} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Choose…</option>{STORE_REPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><Label htmlFor="sr-loc">Where exactly?</Label><Input id="sr-loc" className="h-11" required maxLength={200} placeholder="e.g. Aisle 3 near dairy" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        <div><Label htmlFor="sr-problem">What's wrong?</Label><Textarea id="sr-problem" required minLength={5} maxLength={2000} rows={5} value={f.problem} onChange={(e) => setF({ ...f, problem: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">For emergencies, tell a member of staff straight away.</p>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button className="h-11 w-full" disabled={busy}>{busy ? "Sending…" : "Send report"}</Button>
      </form>}
  </main>;
}
