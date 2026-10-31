import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HardDrive, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isStorageAddon } from "@/lib/hq";
import { sortModules, moduleLabel } from "@/lib/module-categories";
import { Button } from "@/components/ui/button";
import { CompanySeatStatus } from '@/components/company-seat-status';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Catalog = Database["public"]["Tables"]["platform_catalog"]["Row"];
type Sub = Database["public"]["Tables"]["platform_subscriptions"]["Row"];

const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(bytes < 1024 ** 3 ? 2 : 1);

/** Read-only summary of what a company has activated; changes go through Setup package. */
export function HQCompanyEntitlements({ subscription: s, catalog, money, companyName }: { subscription: Sub; catalog: Catalog[]; money: (v: number) => string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const plan = catalog.find((c) => c.id === s.plan_id);
  const assigned = catalog.filter((c) => s.pack_ids.includes(c.id));
  const modulePacks = assigned.filter((c) => !isStorageAddon(c));
  const storagePacks = assigned.filter(isStorageAddon);
  const baseGb = plan ? plan.storage_gb || 10 : 10;
  const packGb = modulePacks.reduce((t, p) => t + (p.storage_gb ?? 0), 0);
  const extraGb = storagePacks.reduce((t, p) => t + (p.storage_gb ?? 0), 0);
  const usage = useQuery({
    queryKey: ["hq-storage-usage", s.company_id], enabled: open && !!s.company_id,
    queryFn: async () => { if (!s.company_id) return null; const r = await supabase.rpc("company_storage_usage", { _company: s.company_id }); if (r.error) throw r.error; return r.data as { used_bytes: number; allowance_gb: number } | null; },
  });
  const trialEnded = new Date(s.trial_ends_at).getTime() <= Date.now();
  const days = Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 86_400_000);
  const status = s.status === "trial" ? (trialEnded ? "Trial expired (read-only)" : `Trial · ${days} day${days === 1 ? "" : "s"} left`) : s.status === "active" ? "Paid subscription" : s.status === "read_only" ? "Read-only / lapsed" : s.status.replace("_", " ");
  const summary = `${modulePacks.length} pack${modulePacks.length === 1 ? "" : "s"} · ${baseGb + packGb + extraGb} GB`;
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)} aria-label={`${companyName}: packs and storage`}><Package className="mr-1 h-4 w-4" />{summary}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Packs & storage · {companyName}</DialogTitle><DialogDescription>What this company has activated. Use Setup package to change it.</DialogDescription></DialogHeader>
      {s.company_id && <CompanySeatStatus companyId={s.company_id} />}
      <section className="space-y-1 rounded-md border p-3 text-sm">
        <p className="text-xs uppercase text-muted-foreground">Status</p>
        <p className="font-medium">{status}</p>
        <p className="text-muted-foreground">{s.status === "trial" ? `Trial ends ${s.trial_ends_at.slice(0, 10)}${s.trial_package_only ? " · package access only" : " · all features during trial"}` : `${money(Number(s.agreed_price))} / ${s.cadence}`}</p>
      </section>
      <section className="space-y-1 rounded-md border p-3 text-sm">
        <p className="text-xs uppercase text-muted-foreground">Tier</p>
        <p className="font-medium">{plan?.name ?? "Full trial / custom"}</p>
        <p className="text-muted-foreground">{s.seats} licensed users · {baseGb} GB storage included</p>
      </section>
      <section className="space-y-2 text-sm">
        <p className="text-xs uppercase text-muted-foreground">Add-on packs</p>
        {!modulePacks.length && <p className="text-muted-foreground">No add-on packs.</p>}
        {modulePacks.map((p) => <div key={p.id} className="rounded-md border p-3">
          <div className="flex justify-between gap-2"><p className="font-medium">{p.name}</p><span className="text-xs text-muted-foreground">{s.status === "trial" && !trialEnded ? "Trial" : "Paid"} · {money(Number(p.monthly_price))}/mo</span></div>
          {p.storage_gb > 0 && <p className="text-xs text-muted-foreground">Includes +{p.storage_gb} GB storage</p>}
          <div className="mt-2 flex flex-wrap gap-1">{sortModules(p.modules).map((m) => <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs">{moduleLabel(m)}</span>)}</div>
        </div>)}
      </section>
      <section className="space-y-2 rounded-md border p-3 text-sm">
        <p className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><HardDrive className="h-4 w-4" />Storage</p>
        <div className="flex justify-between"><span>Included with tier</span><span>{baseGb} GB</span></div>
        {packGb > 0 && <div className="flex justify-between"><span>Included with packs</span><span>+{packGb} GB</span></div>}
        {storagePacks.map((p) => <div key={p.id} className="flex justify-between"><span>Upgraded storage · {p.name}</span><span>+{p.storage_gb} GB</span></div>)}
        <div className="flex justify-between border-t pt-2 font-medium"><span>Total allowance</span><span>{usage.data?.allowance_gb ?? baseGb + packGb + extraGb} GB</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Used</span><span>{!s.company_id ? "External product" : usage.isPending ? "Checking…" : usage.error ? "Unavailable" : `${gb(usage.data?.used_bytes ?? 0)} GB`}</span></div>
      </section>
    </DialogContent></Dialog>
  </>;
}
