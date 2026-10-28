import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { useCompanyRules } from "@/lib/company";
import { brandedQr } from "@/lib/qr-sticker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PLAQUE_SIZES, plaqueHtml, type PlaqueSize } from "@/lib/store-plaque";

/** Printable store-wide fault reporting plaques (store fabric, toilets, lighting…), for staff and visitors. */
export function StorePlaques() {
  const { data: p } = useProfile();
  const { data: company } = useCompanyRules();
  const qc = useQueryClient();
  const [site, setSite] = useState("");
  const [size, setSize] = useState<PlaqueSize>("a4");
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
  const sites = useQuery({ queryKey: ["plaque-sites"], queryFn: async () => { const r = await supabase.from("sites").select("id,name").order("name"); if (r.error) throw r.error; return r.data; } });
  const links = useQuery({ queryKey: ["store-report-links"], queryFn: async () => { const r = await supabase.from("store_report_links").select("id,site_id,created_at,revoked_at").is("revoked_at", null); if (r.error) throw r.error; return r.data; } });
  const active = (links.data ?? []).filter((l) => l.site_id === site).length;

  const print = async () => {
    const store = sites.data?.find((s) => s.id === site);
    if (!store) { toast.error("Choose a store first"); return; }
    const w = window.open("", "_blank");
    if (!w) { toast.error("Allow pop-ups to print the plaque"); return; }
    setBusy(true);
    try {
      const r = await supabase.rpc("create_store_report_link", { _site: store.id });
      if (r.error) throw r.error;
      const qr = await brandedQr(`${window.location.origin}/store-report/${r.data}`, company?.logo || undefined, 900);
      w.document.write(plaqueHtml({ size, copies, qr, store: store.name ?? "Store", company: p?.companies?.name ?? "", logo: company?.logo || undefined }));
      w.document.close();
      w.onload = () => w.print();
      setTimeout(() => w.print(), 600);
      await qc.invalidateQueries({ queryKey: ["store-report-links"] });
    } catch (e) { w.close(); toast.error(e instanceof Error ? e.message : "Could not prepare the plaque"); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!confirm("Turn off every printed plaque for this store? Old posters will stop working.")) return;
    const r = await supabase.from("store_report_links").update({ revoked_at: new Date().toISOString() }).eq("site_id", site).is("revoked_at", null);
    if (r.error) toast.error(r.error.message); else { toast.success("Old plaques turned off"); void qc.invalidateQueries({ queryKey: ["store-report-links"] }); }
  };

  return <section className="space-y-3 rounded-lg border bg-card p-4">
    <div className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /><h2 className="font-medium">Store fault reporting plaque</h2></div>
    <p className="text-sm text-muted-foreground">One QR for the whole store — staff and customers scan it to report floors, toilets, lighting, doors, spills or anything without its own sticker. Print as many as you need and place them around the store.</p>
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="sm:col-span-2"><Label htmlFor="plaque-site">Store</Label><NativeSelect id="plaque-site" value={site} onValueChange={setSite}><option value="">Choose store…</option>{sites.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></div>
      <div><Label htmlFor="plaque-size">Size</Label><NativeSelect id="plaque-size" value={size} onValueChange={(v) => setSize(v as PlaqueSize)}>{Object.entries(PLAQUE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</NativeSelect></div>
      <div><Label htmlFor="plaque-copies">Copies</Label><Input id="plaque-copies" type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} /></div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={!site || busy} onClick={() => void print()}><Printer className="mr-1 h-4 w-4" />{busy ? "Preparing…" : "Print plaque"}</Button>
      {site && active > 0 && <><span className="text-xs text-muted-foreground">{active} printed plaque{active === 1 ? "" : "s"} active</span><Button variant="ghost" size="sm" onClick={() => void revoke()}>Turn off old plaques</Button></>}
    </div>
  </section>;
}
