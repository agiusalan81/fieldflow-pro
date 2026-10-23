import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { staffSignatureEligible, validStaffSignature } from "@/lib/staff-signature";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function StaffSignatureEditor({ onSaved }: { onSaved?: () => void }) {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile || !staffSignatureEligible(profile.real_role) || !staffSignatureEligible(profile.role)) return null;
  const save = async () => {
    if (!validStaffSignature(signature)) { toast.error("Draw your signature before saving"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("save_my_staff_signature", { _signature: signature });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Signature saved"); onSaved?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save signature"); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3">
    {profile.signature_on_file && <img src={profile.signature_on_file} alt="Saved staff signature" className="h-20 max-w-full object-contain" />}
    <SignaturePad value={signature} onChange={setSignature} label="Your staff signature" caption="Your signature" />
    <Button onClick={() => void save()} disabled={busy || !validStaffSignature(signature)}>{busy ? "Saving…" : profile.signature_on_file ? "Replace signature" : "Save signature"}</Button>
  </div>;
}

export function StaffSignatureOnboarding() {
  const { data: profile } = useProfile();
  const [deferredFor, setDeferredFor] = useState<string | null>(null);
  if (!profile || !staffSignatureEligible(profile.real_role) || !staffSignatureEligible(profile.role) || profile.signature_on_file || deferredFor === profile.id) return null;
  return <Dialog open onOpenChange={open => { if (!open) setDeferredFor(profile.id); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Your staff signature</DialogTitle></DialogHeader><StaffSignatureEditor onSaved={() => setDeferredFor(profile.id)} /><Button variant="ghost" onClick={() => setDeferredFor(profile.id)}>Later</Button></DialogContent></Dialog>;
}