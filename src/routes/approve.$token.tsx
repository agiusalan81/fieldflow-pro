import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseTerms, proposalTotals, type Line } from "@/lib/proposals";
import { lineTotal } from "@/lib/price-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/approve/$token")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Review and approve proposal — FieldBridge" },
    { name: "description", content: "Review a service proposal and accept or decline it online." },
    { property: "og:title", content: "Review and approve proposal — FieldBridge" },
    { property: "og:description", content: "Accept or decline a service proposal securely online." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ApprovePage,
});

type Snap = { reference: string; title: string; client: string | null; company: string; lines: unknown; terms: unknown; decision: string | null; decided_at: string | null; signer_name: string | null; expires_at: string };

function ApprovePage() {
  const { token } = Route.useParams();
  const valid = /^[a-f0-9]{64}$/.test(token);
  const [name, setName] = useState(""), [comment, setComment] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const q = useQuery({ queryKey: ["proposal-approval", token], enabled: valid, retry: false, queryFn: async () => {
    const r = await supabase.rpc("read_proposal_approval", { _token: token });
    if (r.error) throw r.error;
    return (r.data ?? null) as unknown as Snap | null;
  } });
  const decide = async (decision: "accepted" | "declined") => {
    if (name.trim().length < 2) { setError("Please type your full name."); return; }
    setBusy(true); setError("");
    const r = await supabase.rpc("decide_proposal_approval", { _token: token, _decision: decision, _name: name.trim(), _comment: comment.trim() });
    setBusy(false);
    if (r.error) setError(r.error.message); else q.refetch();
  };
  const d = q.data;
  const lines = (Array.isArray(d?.lines) ? d.lines : []) as Line[];
  const terms = parseTerms(d?.terms ?? {});
  const totals = proposalTotals(lines, terms);
  const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "EUR" });
  return <main className="mx-auto max-w-2xl px-5 py-10">
    {!valid || (!q.isPending && !q.isError && !d) ? <p role="alert">This approval link is unavailable or has expired.</p>
      : q.isPending ? <p role="status">Loading proposal…</p>
      : q.isError ? <div className="space-y-3"><p role="alert">The proposal could not be loaded.</p><Button variant="outline" onClick={() => q.refetch()}>Retry</Button></div>
      : d && <div className="space-y-6">
        <header><p className="text-sm font-medium text-muted-foreground">{d.company}</p><h1 className="mt-1 text-2xl font-semibold">{d.title || "Proposal"}</h1><p className="text-sm text-muted-foreground">{d.reference}{d.client ? ` · ${d.client}` : ""}</p></header>
        <section className="rounded-lg border bg-card">
          <ul className="divide-y">
            {Number(terms.offer_net) > 0 && <li className="flex justify-between gap-3 p-3 text-sm"><span>Main offer</span><span>{money(Number(terms.offer_net))}</span></li>}
            {lines.map((l, i) => <li key={i} className="flex justify-between gap-3 p-3 text-sm"><span>{l.name}{l.optional ? " (optional)" : ""} <span className="text-muted-foreground">× {l.quantity}</span></span><span>{money(lineTotal(l.quantity, l.rate, l.vat).net)}</span></li>)}
          </ul>
          <dl className="space-y-1 border-t p-3 text-sm"><div className="flex justify-between"><dt>Net</dt><dd>{money(totals.net)}</dd></div><div className="flex justify-between"><dt>VAT</dt><dd>{money(totals.vat)}</dd></div><div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(totals.total)}</dd></div></dl>
        </section>
        {terms.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{terms.notes}</p>}
        {d.decision ? <div role="status" className="rounded-lg border bg-card p-4"><p className="font-medium">Proposal {d.decision} by {d.signer_name}</p><p className="text-sm text-muted-foreground">{d.decided_at ? new Date(d.decided_at).toLocaleString() : ""}</p></div>
          : <section className="space-y-4">
            <div><Label htmlFor="ap-name">Your full name</Label><Input id="ap-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label htmlFor="ap-comment">Comment (optional)</Label><Textarea id="ap-comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Typing your name and accepting confirms your approval of this proposal as shown above. Link valid until {new Date(d.expires_at).toLocaleDateString()}.</p>
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <div className="flex gap-2"><Button disabled={busy} onClick={() => decide("accepted")}>Accept proposal</Button><Button variant="outline" disabled={busy} onClick={() => decide("declined")}>Decline</Button></div>
          </section>}
      </div>}
  </main>;
}
