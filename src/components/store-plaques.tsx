import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import { PLAQUE_SIZES, defaultPlaqueMessages, plaqueHtml, type PlaqueSize } from "@/lib/store-plaque";
import { PlaqueMessageEditor } from "@/components/plaque-message-editor";
import { useEdition } from "@/lib/plan-features";

/** Printable store-wide fault reporting plaques (store fabric, toilets, lighting…), for staff and visitors. */
export function StorePlaques() {
  const { data: p } = useProfile();
  const { data: company } = useCompanyRules();
  const qc = useQueryClient();
  const { edition } = useEdition();
  const locationLabel = edition === "hotel" ? "Property" : "Store";
  const editable = edition === "hotel" || edition === "retail";
  const [messages, setMessages] = useState(defaultPlaqueMessages);
  const [previewQr, setPreviewQr] = useState("");
  useEffect(() => { let active = true; void brandedQr("Preview only — not a reporting link", company?.logo || undefined, 900).then(qr => { if (active) setPreviewQr(qr); }).catch(() => { if (active) toast.error("Could not load plaque preview"); }); return () => { active = false; }; }, [company?.logo]);
  const [site, setSite] = useState("");
  const [size, setSize] = useState<PlaqueSize>("a4");
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
  const sites = useQuery({ queryKey: ["plaque-sites"], queryFn: async () => { const r = await supabase.from("sites").select("id,name").order("name"); if (r.error) throw r.error; return r.data; } });
  const links = useQuery({ queryKey: ["store-report-links"], queryFn: async () => { const r = await supabase.from("store_report_links").select("id,site_id,created_at,revoked_at").is("revoked_at", null); if (r.error) throw r.error; return r.data; } });
  const active = (links.data ?? []).filter((l) => l.site_id === site).length;

  const print = async () => {
    const store = sites.data?.find((s) => s.id === site);
    if (!store) { toast.error(`Choose a ${locationLabel.toLowerCase()} first`); return; }
    const w = window.open("", "_blank");
    if (!w) { toast.error("Allow pop-ups to print the plaque"); return; }
    setBusy(true);
    try {
      const r = await supabase.rpc("create_store_report_link", { _site: store.id });
      if (r.error) throw r.error;
      const qr = await brandedQr(`${window.location.origin}/store-report/${r.data}`, company?.logo || undefined, 900);
      w.document.write(plaqueHtml({ size, copies, qr, store: store.name ?? locationLabel, company: p?.companies?.name ?? "", logo: company?.logo || undefined, ...(editable ? messages : {}) }));
      w.document.close();
      await Promise.all([w.document.fonts.ready, ...Array.from(w.document.images).map(img => img.decode().catch(() => undefined))]);
      w.print();
      await qc.invalidateQueries({ queryKey: ["store-report-links"] });
    } catch (e) { w.close(); toast.error(e instanceof Error ? e.message : "Could not prepare the plaque"); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!confirm("Turn off every printed plaque for this store? Old posters will stop working.")) return;
    const r = await supabase.from("store_report_links").update({ revoked_at: new Date().toISOString() }).eq("site_id", site).is("revoked_at", null);
    if (r.error) toast.error(r.error.message); else { toast.success("Old plaques turned off"); void qc.invalidateQueries({ queryKey: ["store-report-links"] }); }
  };

  return <section className="space-y-4 border-b pb-6">
    <div className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /><h2 className="font-medium">{locationLabel} fault reporting plaque</h2></div>
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="sm:col-span-2"><Label htmlFor="plaque-site">{locationLabel}</Label><NativeSelect id="plaque-site" value={site} onValueChange={setSite}><option value="">Choose {locationLabel.toLowerCase()}…</option>{sites.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></div>
      <div><Label htmlFor="plaque-size">Size</Label><NativeSelect id="plaque-size" value={size} onValueChange={(v) => setSize(v as PlaqueSize)}>{Object.entries(PLAQUE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</NativeSelect></div>
      <div><Label htmlFor="plaque-copies">Copies</Label><Input id="plaque-copies" type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} /></div>
    </div>
    {editable && <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-5"><PlaqueMessageEditor label="Headline" maxLength={80} value={messages.headline} onChange={headline => setMessages(v => ({ ...v, headline }))} /><PlaqueMessageEditor label="Subtitle" maxLength={160} value={messages.subtitle} onChange={subtitle => setMessages(v => ({ ...v, subtitle }))} /></div>
      <div className="min-w-0 space-y-2 lg:sticky lg:top-20"><h3 className="text-sm font-medium">Plaque preview</h3><PlaquePreview size={size} html={plaqueHtml({ size, copies: 1, qr: previewQr, store: sites.data?.find(s => s.id === site)?.name ?? locationLabel, company: p?.companies?.name ?? "", logo: company?.logo || undefined, ...messages })} /></div>
    </div>}
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={!site || busy} onClick={() => void print()}><Printer className="mr-1 h-4 w-4" />{busy ? "Preparing…" : "Print plaque"}</Button>
      {site && active > 0 && <><span className="text-xs text-muted-foreground">{active} printed plaque{active === 1 ? "" : "s"} active</span><Button variant="ghost" size="sm" onClick={() => void revoke()}>Turn off old plaques</Button></>}
    </div>
  </section>;
}

function PlaquePreview({ html, size }: { html: string; size: PlaqueSize }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const page = PLAQUE_SIZES[size];
  useEffect(() => { const el = ref.current; if (!el) return; const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0)); observer.observe(el); return () => observer.disconnect(); }, []);
  return <div ref={ref} className="plaque-preview mx-auto w-full max-w-sm overflow-hidden border" style={{ "--plaque-ratio": `${page.width} / ${page.height}`, "--plaque-scale": width / (page.width * 96 / 25.4), "--plaque-width": `${page.width}mm`, "--plaque-height": `${page.height}mm` } as CSSProperties}><iframe title="Plaque preview" sandbox="" srcDoc={html} className="plaque-preview-frame" /></div>;
}
