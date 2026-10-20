import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { discardLocalDraft, getLocalDraft } from "@/lib/offline";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export function DiscardOfflineDraft({ userId, sheetId }: { userId: string; sheetId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: draft } = useQuery({ queryKey: ["local-draft", userId, sheetId], queryFn: () => getLocalDraft(userId, sheetId) });
  if (!draft) return null;
  const discard = async () => {
    setBusy(true);
    try {
      await discardLocalDraft(userId, sheetId);
      qc.removeQueries({ queryKey: ["sheet", sheetId] });
      await qc.invalidateQueries({ queryKey: ["local-draft", userId, sheetId] });
      setOpen(false);
      toast.success("Device draft discarded");
    } catch { toast.error("Could not discard the draft. Please try again."); }
    finally { setBusy(false); }
  };
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Discard draft</Button>
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Discard this device draft?</AlertDialogTitle><AlertDialogDescription>This removes this job sheet’s unsynced changes and photos from this device only. Saved job sheets are not deleted. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep draft</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={discard}>{busy ? "Discarding…" : "Discard device draft"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}