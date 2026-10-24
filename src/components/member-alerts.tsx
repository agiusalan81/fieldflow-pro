import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Kin, Profile } from "@/lib/profile";
import { missingProfileFields } from "@/lib/field-rules";
import { playChime } from "@/lib/chime";
import { notifyChatMessage } from "@/lib/chat-notify";
import { PhoneInput, splitPhone } from "@/components/client-manager";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePlanFeatures } from '@/lib/plan-features';

const GRACE_MS = 7 * 86_400_000;
/** Amber reminder with a 7-day countdown; the details form only blocks the app once the grace period ends. */
export function ProfileCompletionGate({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const missing = missingProfileFields(profile);
  const [f, setF] = useState({ phone: profile.phone_number ?? "", address: profile.home_address ?? "", kin: (profile.next_of_kin_1 ?? {}) as Kin, kin2: (profile.next_of_kin_2 ?? {}) as Kin });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [dueAt, setDueAt] = useState<number | null>(null);
  useEffect(() => {
    const key = `fieldflow:details-due:${profile.id}`;
    let due = Number(localStorage.getItem(key));
    if (!due) { due = Date.now() + GRACE_MS; localStorage.setItem(key, String(due)); }
    setDueAt(due);
  }, [profile.id]);
  if (!missing.length || dueAt === null) return null;
  const left = dueAt - Date.now();
  const expired = left <= 0;
  const days = Math.floor(left / 86_400_000), hours = Math.floor((left % 86_400_000) / 3_600_000);
  const still = missingProfileFields({ phone_number: f.phone, home_address: f.address, next_of_kin_1: f.kin });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (still.length) return; setBusy(true);
    const { error } = await supabase.from("users").update({ phone_number: f.phone.trim(), home_address: f.address.trim(), next_of_kin_1: f.kin as never, next_of_kin_2: f.kin2 as never }).eq("id", profile.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Personal details saved");
    setOpen(false);
    await qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const kinInput = (k: "name" | "relationship", v: Kin, set: (k: Kin) => void, req: boolean) => (
    <div className="space-y-1.5"><Label className="capitalize">{k}{req && " *"}</Label><Input className="h-11" required={req} value={v[k] ?? ""} onChange={(e) => set({ ...v, [k]: e.target.value })} /></div>
  );
  return (
    <>
    {!expired && <div role="status" className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-warning bg-warning/15 px-4 py-3 text-sm text-foreground">
      <p className="min-w-0 flex-1"><span className="font-medium">Please fill in your personal details and next of kin.</span> {days > 0 ? `${days} day${days === 1 ? "" : "s"} ` : ""}{hours} h left before this becomes required.</p>
      <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90" onClick={() => setOpen(true)}>Fill in now</Button>
    </div>}
    <Dialog open={expired || open} onOpenChange={(o) => { if (!expired) setOpen(o); }}>
      <DialogContent className={`max-h-[92dvh] overflow-y-auto ${expired ? "[&>button]:hidden" : ""}`} onPointerDownOutside={(e) => expired && e.preventDefault()} onEscapeKeyDown={(e) => expired && e.preventDefault()}>
        <DialogHeader><DialogTitle>Complete your personal details</DialogTitle><DialogDescription>{expired ? "The 7 days are up — please fill these in to keep using the app." : "Your company needs these."} They are only visible to your managers. Fields marked * are required.</DialogDescription></DialogHeader>
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
    </>
  );
}

const heard = new Set<string>();
/** Plays a chime for new chat messages, leave decisions and (for managers) urgent unsigned-departure requests. */
export function NotificationSounds({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const on=usePlanFeatures(!!profile);const core=on('core');
  useEffect(() => {
    if(!core)return;
    const uid = profile.id;
    const ch = supabase.channel(`sounds-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, (p) => {
        const m = p.new as { sender_id: string; receiver_id: string | null; job_sheet_id: string | null; message_text: string };
        if (m.sender_id === uid) return;
        if (m.receiver_id && m.receiver_id !== uid) return;
        playChime("message", uid);
        qc.invalidateQueries({ queryKey: ["messages"] }); qc.invalidateQueries({ queryKey: ["messages-unread"] });
        void notifyChatMessage(m, uid);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leave_requests", filter: `user_id=eq.${uid}` }, (p) => {
        const n = p.new as { status: string }, o = p.old as { status?: string };
        if (n.status !== o.status && n.status !== "pending") { playChime("approval", uid); toast.info(n.status === "approved" ? "Your leave was approved" : "Your leave was declined"); qc.invalidateQueries({ queryKey: ["leave"] }); }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leave_requests" }, (p) => {
        if (['technician','maintenance'].includes(profile.real_role) || (p.new as { user_id: string }).user_id === uid) return;
        playChime("message", uid); qc.invalidateQueries({ queryKey: ["leave"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "job_sheets" }, (p) => {
        if (['technician','maintenance'].includes(profile.real_role)) return;
        const n = p.new as { id: string; departure_status: string; departure_requested_at: string | null };
        const k = `${n.id}:${n.departure_requested_at}`;
        if (n.departure_status === "requested" && !heard.has(k)) { heard.add(k); playChime("urgent", uid); qc.invalidateQueries({ queryKey: ["departure-requests"] }); }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile.id, profile.real_role, qc,core]);
  return null;
}
