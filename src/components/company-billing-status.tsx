import { lazy, Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isLapsed, isOverdue, isPayable, storageLevel } from "@/lib/saas-billing";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const InvoiceCheckout = lazy(() => import("@/components/invoice-checkout").then((m) => ({ default: m.InvoiceCheckout })));
const paymentsReady = !!import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

const MESSAGES = {
  ok: "",
  warning: "You have used over 80% of your storage. Consider adding a storage pack.",
  critical: "You have used over 90% of your storage. Add a storage pack soon.",
  full: "Storage is full. Existing records stay available, but please add a storage pack before uploading more files.",
} as const;

export function CompanyBillingStatus({ companyId, money }: { companyId: string; money: (v: number) => string }) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<{ id: string; number: string; total: number } | null>(null);
  const { data, error } = useQuery({ queryKey: ["company-billing", companyId], refetchInterval: paying ? false : 15000, queryFn: async () => {
    const [u, i] = await Promise.all([supabase.rpc("company_storage_usage", { _company: companyId }), supabase.from("platform_invoices").select("*").order("issue_date", { ascending: false }).limit(24)]);
    if (u.error || i.error) throw u.error || i.error;
    return { usage: u.data as { used_bytes: number; allowance_gb: number }, invoices: i.data };
  } });
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data) return null;
  const lv = storageLevel(Number(data.usage.used_bytes), data.usage.allowance_gb);
  const today = new Date().toISOString().slice(0, 10);
  const lapsed = data.invoices.some((i) => isLapsed(i, today));
  return <>
    {lapsed && <section className="border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">An invoice is more than 14 days overdue, so your workspace is read-only. Records and exports are still available. Editing comes back as soon as the invoice is paid.</section>}
    <section className="space-y-2 border-t pt-6"><h2 className="text-lg font-semibold">Storage</h2>
      <Progress value={Math.min(100, lv.pct)} aria-label="Storage used" />
      <p className="text-sm">{(Number(data.usage.used_bytes) / 1024 ** 3).toFixed(2)} GB of {data.usage.allowance_gb} GB used ({lv.pct}%)</p>
      {lv.level !== "ok" && <p className="text-sm text-destructive">{MESSAGES[lv.level]}</p>}
    </section>
    <section className="space-y-2 border-t pt-6"><h2 className="text-lg font-semibold">Invoices</h2>
      {data.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
      {data.invoices.map((i) => { const late = isOverdue(i, today); return <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
        <span>{i.invoice_number} · {i.kind === "upgrade" ? "Upgrade · " : ""}{i.period_start} → {i.period_end}</span>
        <span className="flex flex-wrap items-center gap-2"><span className={late ? "text-destructive" : ""}>{money(Number(i.total))} · {i.status === "paid" ? `Paid ${i.paid_at?.slice(0, 10) ?? ""}` : i.status === "void" ? "Cancelled" : late ? `Overdue since ${i.due_date}` : `Due ${i.due_date}`}</span>
          {isPayable(i) && paymentsReady && <Button size="sm" onClick={() => setPaying({ id: i.id, number: i.invoice_number, total: Number(i.total) })}>Pay invoice</Button>}
        </span>
        {i.payment_error && i.status !== "paid" && <p className="w-full text-xs text-destructive">Last payment attempt: {i.payment_error}</p>}
      </div>; })}
      <p className="text-xs text-muted-foreground">Paying by card saves it for future FieldBridge invoices. You can still pay by bank transfer quoting the invoice number.</p>
    </section>
    <Dialog open={!!paying} onOpenChange={(o) => { if (!o) { setPaying(null); void qc.invalidateQueries({ queryKey: ["company-billing", companyId] }); void qc.invalidateQueries({ queryKey: ["company-commercial"] }); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Pay {paying?.number}</DialogTitle><DialogDescription>{paying ? money(paying.total) : ""} including VAT</DialogDescription></DialogHeader>
        {paying && <Suspense fallback={<p className="text-sm text-muted-foreground">Loading payment form…</p>}><InvoiceCheckout invoiceId={paying.id} /></Suspense>}
      </DialogContent>
    </Dialog>
  </>;
}
