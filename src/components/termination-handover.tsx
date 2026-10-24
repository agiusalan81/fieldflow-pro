import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyUsers, ROLE_LABEL } from "@/lib/profile";
import { handoverChoices, type HandoverPreview } from "@/lib/member-handover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TerminationHandover({ member, onClose }: { member: { id: string; full_name: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: users = [] } = useCompanyUsers();
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const preview = useQuery({ queryKey: ["member-handover", member.id], staleTime: 0, queryFn: async () => {
    const r = await supabase.rpc("member_handover_preview", { _user: member.id });
    if (r.error) throw r.error;
    return r.data as unknown as HandoverPreview;
  } });
  const confirm = async () => {
    if (!preview.data) return;
    setBusy(true);
    try {
      const choices = handoverChoices(preview.data.jobs, selected);
      const r = await supabase.rpc("terminate_member_handover", { _user: member.id, _reason: reason.trim(), _choices: choices });
      if (r.error) throw r.error;
      await qc.invalidateQueries();
      toast.success("Access revoked and handover saved"); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Handover could not be saved. No changes were made."); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Termination handover · {member.full_name}</DialogTitle></DialogHeader>
    {preview.isPending ? <p role="status">Checking scheduled work…</p> : preview.error ? <div role="alert"><p className="text-destructive">Unable to check the handover. Access has not changed.</p><Button variant="outline" onClick={() => void preview.refetch()}>Retry</Button></div> : preview.data && <>
      <p className="text-sm text-muted-foreground">Company access will be blocked. Historical job sheets, location evidence and payroll remain unchanged.</p>
      <h3 className="font-medium">Scheduled work ({preview.data.jobs.length})</h3>
      {preview.data.jobs.length === 0 && <p className="text-sm text-muted-foreground">No upcoming unfinished assignments.</p>}
      {preview.data.jobs.map(job => <div key={job.id} className="space-y-2 border-b pb-3"><p className="text-sm">#{job.number} · {job.date} · {job.slot}<br/>{job.summary}</p><Label htmlFor={`handover-${job.id}`}>Reassign job #{job.number}</Label><Select value={selected[job.id] ?? ""} onValueChange={value => setSelected(s => ({ ...s, [job.id]: value }))}><SelectTrigger id={`handover-${job.id}`}><SelectValue placeholder="Choose replacement or dispatch"/></SelectTrigger><SelectContent><SelectItem value="dispatch">Return vacancy to office dispatch</SelectItem>{users.filter(u => u.id !== member.id && u.registration_status === "active" && ["technician", "supervisor", "maintenance"].includes(u.role)).map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} · {ROLE_LABEL[u.role]}</SelectItem>)}</SelectContent></Select></div>)}
      <p className="text-sm">{preview.data.tracks.length ? `Remove from ${preview.data.tracks.join(" and ")} rota; remaining members continue the rotation.` : "No saved rota placement."}</p>
      <p className="text-sm">{preview.data.openShifts} open shifts will be closed with an office audit note.</p>
      {!!preview.data.swaps && <p className="text-sm text-warning">{preview.data.swaps} upcoming swaps involve this member and need a new cover arrangement.</p>}
      <Label htmlFor="termination-reason">Reason</Label><Input id="termination-reason" maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/>
    </>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={busy || !reason.trim() || !preview.data || preview.data.jobs.some(j => selected[j.id] === undefined)} onClick={() => void confirm()}>{busy ? "Saving…" : "Confirm termination & handover"}</Button></div>
  </DialogContent></Dialog>;
}