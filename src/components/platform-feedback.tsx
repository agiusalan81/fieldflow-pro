import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { useUserPreview } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
export function PlatformFeedback() {
  const { data: actor } = useProfile(); const preview = useUserPreview(actor);
  const [open, setOpen] = useState(false); const [message, setMessage] = useState(""); const [category, setCategory] = useState("other"); const [rating, setRating] = useState(3); const [busy, setBusy] = useState(false);
  const invitations = useQuery({ queryKey: ["platform-feedback-invitations", actor?.id, actor?.company_id], enabled: !!actor && !preview.active, staleTime: 60000, queryFn: async () => {
    const r = await supabase.from("platform_engagement_actions").select("id,subject,body,created_at").eq("status", "open").eq("action_key", "feedback").order("created_at", { ascending: false }).limit(1);
    if (r.error) throw r.error; return r.data ?? [];
  } });
  if (!actor || preview.active || actor.role !== actor.real_role) return null;
  const invite = invitations.data?.[0];
  return <><Button variant="ghost" size="icon" aria-label="Share product feedback" title="Share product feedback" onClick={() => setOpen(true)}><MessageSquare className="h-5 w-5" />{invite && <span className="h-2 w-2 rounded-full bg-warning" />}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{invite?.subject ?? "Share your feedback"}</DialogTitle></DialogHeader>{invite && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{invite.body}</p>}<Label>How is it going?</Label><div className="flex gap-2" role="group" aria-label="Product rating">{[1,2,3,4,5].map(n => <Button key={n} size="icon" variant={rating===n?"default":"outline"} aria-label={`${n} stars`} aria-pressed={rating===n} onClick={() => setRating(n)}><Star className="h-4 w-4" /></Button>)}</div><Label htmlFor="feedback-category">Topic</Label><NativeSelect id="feedback-category" value={category} onValueChange={setCategory}>{[["setup","Getting started"],["missing_feature","Missing feature"],["pricing","Pricing"],["bug","Something isn't working"],["other","Other"]].map(([key,label]) => <option key={key} value={key}>{label}</option>)}</NativeSelect><Label htmlFor="feedback-message">What would make this better for your team?</Label><Textarea id="feedback-message" value={message} maxLength={2000} onChange={e => setMessage(e.target.value)} /><p className="text-xs text-muted-foreground">Do not include customer records, passwords, payroll or medical information.</p><DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button disabled={busy || !message.trim()} onClick={async () => { setBusy(true); try { const r = await supabase.rpc("submit_platform_feedback", { _rating: rating, _category: category, _message: message.trim() }); if(r.error) throw r.error; toast.success("Thank you — your feedback was sent"); setMessage(""); setOpen(false); } catch(e) { toast.error(e instanceof Error ? e.message : "Could not send feedback"); } finally {setBusy(false);} }}>Send feedback</Button></DialogFooter></DialogContent></Dialog></>;
}