import { ReportPhoto } from "@/components/qr-report-photo";
import {WorkspaceThread} from '@/components/workspace-thread';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Open store-wide reports submitted from printed store plaques. */
export function StoreProblemQueue() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["store-problem-reports"], refetchInterval: 30000, queryFn: async () => {
    const r = await supabase.from("store_problem_reports").select("id,reporter_type,reporter_name,category,location,problem,created_at,sites(name)").eq("status", "open").order("created_at", { ascending: false });
    if (r.error) throw r.error; return r.data;
  } });
  if (!q.data?.length && !q.error) return null;
  const close = async (id: string) => {
    if (!confirm("Close this store report?")) return;
    const x = await supabase.from("store_problem_reports").update({ status: "closed" }).eq("id", id);
    if (x.error) toast.error(x.error.message); else await qc.invalidateQueries({ queryKey: ["store-problem-reports"] });
  };
  return <section className="space-y-3">
    <h2 className="font-medium">Reported store problems</h2>
    {q.error && <p role="alert" className="text-destructive">Could not load store reports.</p>}
    <ul className="space-y-2">{q.data?.map((r) => <li key={r.id} id={`store-report-${r.id}`} className="rounded-lg border bg-card p-4">
      <p className="font-medium">{r.sites?.name} · {r.category} · {r.location}</p>
      <p className="text-xs text-muted-foreground">{r.reporter_type === "visitor" ? "Customer / visitor" : "Store staff"}{r.reporter_name ? ` · ${r.reporter_name}` : ""} · {new Date(r.created_at ?? "").toLocaleString()}</p>
      <p className="my-3 whitespace-pre-wrap text-sm">{r.problem}</p>
      <ReportPhoto reportId={r.id} kind="store"/>
      <WorkspaceThread kind="store" recordId={r.id}/>
      <Button variant="outline" size="sm" onClick={() => void close(r.id)}>Close report</Button>
    </li>)}</ul>
  </section>;
}
