import { useEffect, useState } from "react";
import { currentPosition, etaBadge, etaText, travelEta } from "@/lib/travel-eta";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, FileText, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startJobTravel } from "@/lib/jobsheets";
import { sendClientNotice } from "@/lib/client-notices.functions";
import { useNoticeEnabled } from "@/components/client-notices";
import type { Profile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function JobTravelActions({ profile, jobId, address, readOnly = false, assisting = false }: { profile: Profile; jobId: string; address?: string | null | undefined; readOnly?: boolean; assisting?: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [startedId, setStartedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeEnabled = useNoticeEnabled("on_my_way");
  const { data: sheet, isPending, isError } = useQuery({
    queryKey: ["job-travel-sheet", jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_sheets").select("id, status").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const travelling = sheet?.status === "in_transit";
  const [eta, setEta] = useState<{ km: number; minutes: number } | null>(null);
  // While in transit, refresh distance/time from live GPS every minute.
  useEffect(() => {
    if (!travelling || !address) return;
    let off = false;
    const tick = async () => { const p = await currentPosition(); if (!p || off) return; const e = await travelEta(p, address); if (!off && e) setEta(e); };
    void tick(); const t = setInterval(tick, 60000);
    return () => { off = true; clearInterval(t); };
  }, [travelling, address]);
  const finished = sheet?.status === "completed" || sheet?.status === "in_progress";
  const start = async () => {
    if (readOnly || assisting || busy) return;
    setBusy(true);
    try {
      const pos = address ? await currentPosition() : null;
      const first = pos && address ? await travelEta(pos, address) : null;
      setEta(first);
      const id = await startJobTravel(profile, jobId);
      setStartedId(id);
      setNotice(null);
      await Promise.all(["job-travel-sheet", "today-jobs", "schedule", "sheets", "overview", "sheet"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      if (!noticeEnabled) {
        setNotice("The “on the way” message is switched off in Company settings → Messages & emails, so the client was not notified.");
      } else {
        try {
          const res = await sendClientNotice({ data: { sheetId: id, event: "on_my_way", ...(first ? { eta: { km: Math.round(first.km * 10) / 10, minutes: Math.min(600, first.minutes) } } : {}) } });
          const ok = [...new Set(res.result.filter((r) => r.ok).map((r) => (r.channel === "email" ? "email" : "WhatsApp")))];
          const bad = res.result.filter((r) => !r.ok).map((r) => r.error).filter(Boolean);
          setNotice(ok.length ? `Client notified by ${ok.join(" and ")}.${bad.length ? ` ${bad.join(" · ")}` : ""}` : `Client could not be notified — ${bad.join(" · ") || "no channel available"}.`);
        } catch (e) {
          setNotice(`Client could not be notified — ${(e as Error).message}`);
        }
      }
      toast.success("Travel started");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not start travel"); }
    finally { setBusy(false); }
  };
  const openSheet = (id?: string) => readOnly ? <Button disabled className="h-11"><FileText className="mr-1 h-4 w-4" />Open job sheet</Button> : <Button asChild variant="outline" className="h-11">{id ? <Link to="/sheets/$sheetId" params={{ sheetId: id }}><FileText className="mr-1 h-4 w-4" />Open job sheet</Link> : <Link to="/sheets/new" search={{ jobId }}><FileText className="mr-1 h-4 w-4" />Open job sheet</Link>}</Button>;
  return <>
    <div className="grid min-w-0 gap-2 [&_a]:w-full [&_button]:w-full [&_a]:min-w-0 [&_button]:min-w-0 [&_a]:whitespace-normal [&_button]:whitespace-normal">
      {!finished && !assisting && <Button data-tour="start-travel" className="h-11" disabled={readOnly || busy || isPending || isError || travelling} onClick={start}><Car className="mr-1 h-4 w-4" />{busy ? "Starting…" : travelling ? `In transit${eta ? ` · ${etaBadge(eta)}` : ""}` : "Start travel"}</Button>}
      {assisting ? sheet ? openSheet(sheet.id) : <span className="text-xs text-muted-foreground">Waiting for the lead to start</span> : openSheet(sheet?.id)}
      {isError && <Button variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["job-travel-sheet", jobId] })}>Retry job status</Button>}
    </div>
    <Dialog open={!!startedId} onOpenChange={(open) => !open && setStartedId(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Travel started</DialogTitle></DialogHeader>
        <p className="break-words text-sm text-muted-foreground">{address || "No address on file"}</p>
        <p className="text-sm font-medium">{eta ? `GPS estimate: ${etaText(eta)}` : "GPS estimate unavailable — location or address could not be found."}</p>
        {address && <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline"><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer"><MapPin className="mr-1 h-4 w-4" />Google Maps</a></Button>
          <Button asChild variant="outline"><a href={`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`} target="_blank" rel="noopener noreferrer"><MapPin className="mr-1 h-4 w-4" />Waze</a></Button>
        </div>}
        {notice && <p className="rounded-lg border bg-muted/50 p-3 text-sm text-foreground">{notice}</p>}
        {openSheet(startedId ?? undefined)}
        <Button variant="ghost" onClick={() => setStartedId(null)}>Continue without navigation</Button>
      </DialogContent>
    </Dialog>
  </>;
}
