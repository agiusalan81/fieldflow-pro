import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function ClientPreapproval({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data, isFetching } = useQuery({ queryKey: ["client-preapproval", clientId], queryFn: async () => {
    const result = await supabase.from("clients").select("preapprove_departure, waive_transport").eq("id", clientId).single();
    if (result.error) throw result.error; return result.data;
  } });
  const toggle = (field: "preapprove_departure" | "waive_transport", value: boolean, ok: string) => async () => {
    const { error } = await supabase.from("clients").update({ [field]: value }).eq("id", clientId);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["client-preapproval", clientId] });
    qc.invalidateQueries({ queryKey: ["sheet-refs"] });
    toast.success(ok);
  };
  return <div>
    <div className="flex items-center justify-between gap-4 border-b py-4">
      <label htmlFor="client-preapproval" className="text-sm font-medium">Pre-approve departure without signature</label>
      <Switch id="client-preapproval" checked={data?.preapprove_departure ?? false} disabled={!data || isFetching} onCheckedChange={(v) => toggle("preapprove_departure", v, v ? "Unsigned departure pre-approved — sheets still need signing later" : "Departure approval required")()} />
    </div>
    <div className="flex items-center justify-between gap-4 border-b py-4">
      <div>
        <label htmlFor="client-waive-transport" className="text-sm font-medium">Waive transport time</label>
        <p className="text-xs text-muted-foreground">Travel hours are hidden on this client's job sheets and not billed.</p>
      </div>
      <Switch id="client-waive-transport" checked={data?.waive_transport ?? false} disabled={!data || isFetching} onCheckedChange={(v) => toggle("waive_transport", v, v ? "Transport time waived for this client" : "Transport time billable again")()} />
    </div>
  </div>;
}
