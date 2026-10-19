import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, FileText, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startJobTravel } from "@/lib/jobsheets";
import type { Profile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function JobTravelActions({ profile, jobId, address, readOnly = false }: { profile: Profile; jobId: string; address?: string | null; readOnly?: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [startedId, setStartedId] = useState<string | null>(null);
  const { data: sheet, isPending, isError } = useQuery({
    queryKey: ["job-travel-sheet", jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_sheets").select("id, status").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const travelling = sheet?.status === "in_transit";
  const finished = sheet?.status === "completed" || sheet?.status === "in_progress";
  const start = async () => {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      const id = await startJobTravel(profile, jobId);
      setStartedId(id);
      await Promise.all(["job-travel-sheet", "today-jobs", "schedule", "sheets", "overview", "sheet"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success("Travel started");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not start travel"); }
    finally { setBusy(false); }
  };
  const openSheet = (id?: string) => readOnly ? <Button disabled className="h-11"><FileText className="mr-1 h-4 w-4" />Open job sheet</Button> : <Button asChild variant="outline" className="h-11">{id ? <Link to="/sheets/$sheetId" params={{ sheetId: id }}><FileText className="mr-1 h-4 w-4" />Open job sheet</Link> : <Link to="/sheets/new" search={{ jobId }}><FileText className="mr-1 h-4 w-4" />Open job sheet</Link>}</Button>;
  return <>
    <div className="grid gap-2">
      {!finished && <Button className="h-11" disabled={readOnly || busy || isPending || isError || travelling} onClick={start}><Car className="mr-1 h-4 w-4" />{busy ? "Starting…" : travelling ? "In transit" : "Start travel"}</Button>}
      {openSheet(sheet?.id)}
      {isError && <Button variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["job-travel-sheet", jobId] })}>Retry job status</Button>}
    </div>
    <Dialog open={!!startedId} onOpenChange={(open) => !open && setStartedId(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Travel started</DialogTitle></DialogHeader>
        <p className="break-words text-sm text-muted-foreground">{address || "No address on file"}</p>
        {address && <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline"><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer"><MapPin className="mr-1 h-4 w-4" />Google Maps</a></Button>
          <Button asChild variant="outline"><a href={`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`} target="_blank" rel="noopener noreferrer"><MapPin className="mr-1 h-4 w-4" />Waze</a></Button>
        </div>}
        {openSheet(startedId ?? undefined)}
      </DialogContent>
    </Dialog>
  </>;
}