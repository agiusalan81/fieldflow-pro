import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

/** Company Settings → what happens when a client accepts a quote online. Writes only its own column. */
export function QuoteAcceptanceSetting({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["quote-acceptance-mode", companyId], queryFn: async () => { const r = await supabase.from("company_settings").select("quote_acceptance_mode").eq("company_id", companyId).single(); if (r.error) throw r.error; return r.data.quote_acceptance_mode; } });
  const save = async (mode: string) => { const r = await supabase.from("company_settings").update({ quote_acceptance_mode: mode }).eq("company_id", companyId); if (r.error) toast.error(r.error.message); else { toast.success("Quote acceptance setting saved"); qc.invalidateQueries({ queryKey: ["quote-acceptance-mode", companyId] }); } };
  return <section className="space-y-2 border-b pb-4">
    <Label htmlFor="quote-acceptance-mode" className="font-semibold">When a client accepts a quote in the portal</Label>
    <select id="quote-acceptance-mode" className="h-11 w-full max-w-md rounded-md border bg-background px-3" value={q.data ?? "manual"} disabled={!q.data} onChange={(e) => void save(e.target.value)}>
      <option value="manual">Flag it as ready to schedule (office books the visit)</option>
      <option value="auto_job">Create an unassigned job automatically</option>
    </select>
    <p className="text-xs text-muted-foreground">The office is notified by email and in the alerts bell either way.</p>
  </section>;
}
