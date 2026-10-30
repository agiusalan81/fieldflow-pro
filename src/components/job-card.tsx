import { useTerminology } from "@/lib/company";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const PRIORITY_CLS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-warning/25 text-warning-foreground",
  urgent: "bg-destructive/15 text-destructive",
};

export function PriorityBadge({ p }: { p: string }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_CLS[p] ?? ""}`}>{p}</span>;
}

export const timeWindow = (a?: string | null, b?: string | null) => (a ? `${a.slice(0, 5)}${b ? `–${b.slice(0, 5)}` : ""}` : "Any time");

export function AssetHistory({ assetId, label }: { assetId: string; label: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["asset-history", assetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_sheets")
        .select("id, jobsheet_number, status, created_at, reported_fault, repairs_performed, technician_name")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : data.length === 0 ? <p className="text-sm text-muted-foreground">No previous job sheets for this equipment.</p> : (
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {data.map((s) => (
            <li key={s.id} className="rounded-lg border p-3 text-sm">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-primary">#{s.jobsheet_number}</span>
                <StatusBadge status={s.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()} · {s.technician_name ?? "—"}</p>
              {s.reported_fault && <p className="mt-1"><span className="text-muted-foreground">Fault:</span> {s.reported_fault}</p>}
              {s.repairs_performed && <p><span className="text-muted-foreground">Repair:</span> {s.repairs_performed}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LiftHistoryButton({ assetId, label }: { assetId: string | null; label: string }) {
  const word=useTerminology();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-auto min-h-11 w-full min-w-0 whitespace-normal text-center" disabled={!assetId}><History className="mr-1 h-4 w-4" />{word("equipment")} history</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{word("equipment")} history</DialogTitle></DialogHeader>
        {assetId && open && <AssetHistory assetId={assetId} label={label} />}
      </DialogContent>
    </Dialog>
  );
}
