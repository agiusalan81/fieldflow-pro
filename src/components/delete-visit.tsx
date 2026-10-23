import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RECORD_DELETE_REFRESH_KEYS } from "@/lib/record-deletion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function DeleteVisit({ id, number, onDeleted }: { id: string; number: number; onDeleted?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error, count } = await supabase.from("jobs").delete({ count: "exact" }).eq("id", id);
      if (error || !count) { toast.error(error?.message ?? "You cannot delete this visit."); return; }
      setOpen(false);
      onDeleted?.();
      await Promise.all(RECORD_DELETE_REFRESH_KEYS.map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(`Visit #${number} deleted`);
    } catch { toast.error("Visit could not be deleted. Please try again."); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <Button size="icon" variant="ghost" className="shrink-0 text-destructive" title="Delete dispatched visit" aria-label={`Delete visit ${number}`} onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" /></Button>
    <DialogContent>
      <DialogHeader><DialogTitle>Delete dispatched visit #{number}?</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">This permanently removes the visit and its crew assignments from the schedule. Any existing job sheets are kept, but are no longer linked to this visit. This cannot be undone.</p>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep visit</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete visit"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}