import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Kin, Profile } from "@/lib/profile";
import { missingProfileFields } from "@/lib/field-rules";
import { playChime } from "@/lib/chime";
import { PhoneInput, splitPhone } from "@/components/client-manager";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Blocks the app until the member's required personal details and next of kin are filled in. */
export function ProfileCompletionGate({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const missing = missingProfileFields(profile);
  const [f, setF] = useState({ phone: profile.phone_number ?? "", address: profile.home_address ?? "", kin: (profile.next_of_kin_1 ?? {}) as Kin, kin2: (profile.next_of_kin_2 ?? {}) as Kin });
  const [busy, setBusy] = useState(false);
  if (!missing.length) return null;
  const still = missingProfileFields({ phone_number: f.phone, home_address: f.address, next_of_kin_1: f.kin });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (still.length) return; setBusy(true);
    const { error } = await supabase.from("users").update({ phone_number: f.phone.trim(), home_address: f.address.trim(), next_of_kin_1: f.kin as never, next_of_kin_2: f.kin2 as never }).eq("id", profile.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Personal details saved");
    await qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const kinInput = (k: "name" | "relationship", v: Kin, set: (k: Kin) => void, req: boolean) => (
    <div className="space-y-1.5"><Label className="capitalize">{k}{req && " *"}</Label><Input className="h-11" required={req} value={v[k] ?? ""} onChange={(e) => set({ ...v, [k]: e.target.value })} /></div>
  );
  return (
    <Dialog open>
      <DialogContent className="max-h-[92dvh] overflow-y-auto [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>Complete your personal details</DialogTitle><DialogDescription>Your company needs these before you start. They are only visible to your managers. Fields marked * are required.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-1.5"><Label>Mobile phone *</Label><PhoneInput required code={splitPhone(f.phone).code} number={splitPhone(f.phone).number} onChange={(c, n) => setF({ ...f, phone: `${c} ${n}`.trim() })} /></div>
          <div className="space-y-1.5"><Label>Home address *</Label><Input className="h-11" required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <fieldset className="space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Next of kin 1 *</legend>
            {kinInput("name", f.kin, (kin) => setF({ ...f, kin }), true)}{kinInput("relationship", f.kin, (kin) => setF({ ...f, kin }), true)}
            <div className="space-y-1.5"><Label>Phone *</Label><PhoneInput required code={splitPhone(f.kin.phone).code} number={splitPhone(f.kin.phone).number} onChange={(c, n) => setF({ ...f, kin: { ...f.kin, phone: `${c} ${n}`.trim() } })} /></div>
          </fieldset>
          <fieldset className="space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Next of kin 2 (optional)</legend>
            {kinInput("name", f.kin2, (kin2) => setF({ ...f, kin2 }), false)}{kinInput("relationship", f.kin2, (kin2) => setF({ ...f, kin2 }), false)}
            <div className="space-y-1.5"><Label>Phone</Label><PhoneInput code={splitPhone(f.kin2.phone).code} number={splitPhone(f.kin2.phone).number} onChange={(c, n) => setF({ ...f, kin2: { ...f.kin2, phone: `${c} ${n}`.trim() } })} /></div>
          </fieldset>
          {still.length > 0 && <p className="text-xs text-muted-foreground">Still needed: {still.join(", ")}</p>}
          <Button type="submit" className="h-12 w-full" disabled={busy || still.length > 0}>Save and continue</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const heard = new Set<string>();
/** Plays a chime for new chat messages, leave decisions and (for managers) urgent unsigned-departure requests. */
export function NotificationSounds({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  useEffect(() => {
    const uid = profile.id;
    const ch = supabase.channel(`sounds-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, (p) => {
        const m = p.new as { sender_id: string; receiver_id: string | null };
        if (m.sender_id === uid) return;
        if (m.receiver_id && m.receiver_id !== uid) return;
        playChime("message", uid); qc.invalidateQueries({ queryKey: ["messages"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leave_requests", filter: `user_id=eq.${uid}` }, (p) => {
        const n = p.new as { status: string }, o = p.old as { status?: string };
        if (n.status !== o.status && n.status !== "pending") { playChime("approval", uid); toast.info(n.status === "approved" ? "Your leave was approved" : "Your leave was declined"); qc.invalidateQueries({ queryKey: ["leave"] }); }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leave_requests" }, (p) => {
        if (profile.real_role === "technician" || (p.new as { user_id: string }).user_id === uid) return;
        playChime("message", uid); qc.invalidateQueries({ queryKey: ["leave"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "job_sheets" }, (p) => {
        if (profile.real_role === "technician") return;
        const n = p.new as { id: string; departure_status: string; departure_requested_at: string | null };
        const k = `${n.id}:${n.departure_requested_at}`;
        if (n.departure_status === "requested" && !heard.has(k)) { heard.add(k); playChime("urgent", uid); qc.invalidateQueries({ queryKey: ["departure-requests"] }); }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile.id, profile.real_role, qc]);
  return null;
}
