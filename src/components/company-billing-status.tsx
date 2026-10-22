import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOverdue, storageLevel } from "@/lib/saas-billing";
import { Progress } from "@/components/ui/progress";

const MESSAGES = {
  ok: "",
  warning: "You have used over 80% of your storage. Consider adding a storage pack.",
  critical: "You have used over 90% of your storage. Add a storage pack soon.",
  full: "Storage is full. Existing records stay available, but please add a storage pack before uploading more files.",
} as const;

export function CompanyBillingStatus({ companyId, money }: { companyId: string; money: (v: number) => string }) {
  const { data, error } = useQuery({ queryKey: ["company-billing", companyId], queryFn: async () => {
    const [u, i] = await Promise.all([supabase.rpc("company_storage_usage", { _company: companyId }), supabase.from("platform_invoices").select("*").order("issue_date", { ascending: false }).limit(24)]);
    if (u.error || i.error) throw u.error || i.error;
    return { usage: u.data as { used_bytes: number; allowance_gb: number }, invoices: i.data };
  } });
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data) return null;
  const lv = storageLevel(Number(data.usage.used_bytes), data.usage.allowance_gb);
  const today = new Date().toISOString().slice(0, 10);
  return <>
    <section className="space-y-2 border-t pt-6"><h2 className="text-lg font-semibold">Storage</h2>
      <Progress value={Math.min(100, lv.pct)} aria-label="Storage used" />
      <p className="text-sm">{(Number(data.usage.used_bytes) / 1024 ** 3).toFixed(2)} GB of {data.usage.allowance_gb} GB used ({lv.pct}%)</p>
      {lv.level !== "ok" && <p className="text-sm text-destructive">{MESSAGES[lv.level]}</p>}
    </section>
    <section className="space-y-2 border-t pt-6"><h2 className="text-lg font-semibold">Invoices</h2>
      {data.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
      {data.invoices.map((i) => { const late = isOverdue(i, today); return <div key={i.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm"><span>{i.invoice_number} · {i.period_start} → {i.period_end}</span><span className={late ? "text-destructive" : ""}>{money(Number(i.total))} · {i.status === "paid" ? `Paid ${i.paid_at?.slice(0, 10) ?? ""}` : late ? `Overdue since ${i.due_date}` : `Due ${i.due_date}`}</span></div>; })}
    </section>
  </>;
}
