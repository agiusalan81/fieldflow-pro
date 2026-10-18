import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
export function ClientPreapproval({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data, isFetching } = useQuery({ queryKey: ["client-preapproval", clientId], queryFn: async () => {
    const result = await supabase.from("clients").select("preapprove_departure").eq("id", clientId).single();
    if (result.error) throw result.error; return result.data;
  } });
  return <div className="flex items-center justify-between gap-4 border-b py-4">
    <label htmlFor="client-preapproval" className="text-sm font-medium">Pre-approve departure without signature</label>
    <Switch id="client-preapproval" checked={data?.preapprove_departure ?? false} disabled={!data || isFetching} onCheckedChange={async (value) => {
      const { error } = await supabase.from("clients").update({ preapprove_departure: value }).eq("id", clientId);
      if (error) { toast.error(error.message); return; }
      await qc.invalidateQueries({ queryKey: ["client-preapproval", clientId] });
      qc.invalidateQueries({ queryKey: ["sheet-refs"] });
      toast.success(value ? "Unsigned departure pre-approved — sheets still need signing later" : "Departure approval required");
    }} />
  </div>;
}