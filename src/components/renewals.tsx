import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyRules } from "@/lib/company";
import { daysUntil, dueForRenewal } from "@/lib/jobsheets";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export function useAgreements() {
  return useQuery({
    queryKey: ["agreements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_agreements").select("*, clients(name), sites(name), contract_types(name, tier, equipment_category)").order("end_date");
      if (error) throw error;
      return data;
    },
  });
}

export function RenewalList({ office, limit }: { office: boolean; limit?: number }) {
  const { data = [] } = useAgreements();
  const { data: c } = useCompanyRules();
  const qc = useQueryClient();
  const due = data.filter((a) => a.status === "active" && (dueForRenewal(a.end_date, c?.renewalDays ?? 30) || daysUntil(a.end_date) < 0));
  const act = async (id: string, patch: Record<string, unknown>, msg: string) => {
    const { error } = await supabase.from("maintenance_agreements").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["agreements"] });
  };
  const renew = (a: (typeof data)[number]) => {
    const s = new Date(a.end_date + "T00:00:00Z"); s.setUTCDate(s.getUTCDate() + 1);
    const e = new Date(s); e.setUTCFullYear(e.getUTCFullYear() + 1); e.setUTCDate(e.getUTCDate() - 1);
    act(a.id, { start_date: s.toISOString().slice(0, 10), end_date: e.toISOString().slice(0, 10), price_confirmed_at: null, renewal_sent_at: null }, "Agreement renewed for another year");
  };
  if (!due.length) return <EmptyState>No contracts expiring in the next {c?.renewalDays ?? 30} days.</EmptyState>;
  return (
    <ul className="space-y-2">
      {due.slice(0, limit).map((a) => {
        const d = daysUntil(a.end_date);
        return (
          <li key={a.id} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{a.clients?.name}{a.sites?.name ? ` · ${a.sites.name}` : ""}</p>
              <p className="text-sm text-muted-foreground">{a.contract_types?.name ?? "Custom"} · €{Number(a.annual_price).toFixed(2)}/yr · ends {a.end_date} · <span className={d < 0 ? "text-destructive" : "text-foreground"}>{d < 0 ? `expired ${-d} days ago` : `${d} days left`}</span></p>
              <p className="text-xs text-muted-foreground">{a.price_confirmed_at ? `Price confirmed ${new Date(a.price_confirmed_at).toLocaleDateString()}` : "Price not confirmed yet"}{a.renewal_sent_at ? ` · Renewal sent ${new Date(a.renewal_sent_at).toLocaleDateString()}` : ""}</p>
            </div>
            {office && (
              <div className="flex flex-wrap gap-2">
                {!a.price_confirmed_at && <Button size="sm" onClick={() => act(a.id, { price_confirmed_at: new Date().toISOString() }, "Price confirmed")}>Confirm price</Button>}
                {a.price_confirmed_at && !a.renewal_sent_at && <Button size="sm" onClick={() => act(a.id, { renewal_sent_at: new Date().toISOString() }, "Marked as sent to client")}>Mark renewal sent</Button>}
                <Button size="sm" variant="outline" onClick={() => renew(a)}>Client signed — renew</Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

