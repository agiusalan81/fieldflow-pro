import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isManager, useProfile } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { skillEligible } from "@/lib/skills";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function MemberSkills({ userId, role, name, editable = false }: { userId: string; role: string; name: string; editable?: boolean }) {
  const { data: profile } = useProfile(); const feature = usePlanFeatures(!!profile); const qc = useQueryClient();
  const enabled = !!profile && feature("skills_dispatch") && skillEligible(role);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState<string | null>(null);
  const skills = useQuery({ queryKey: ["company-skills", profile?.company_id], enabled, queryFn: async () => { const r = await supabase.from("company_skills").select("id,name,category,archived").order("category").order("name"); if (r.error) throw r.error; return r.data; } });
  const links = useQuery({ queryKey: ["member-skills", profile?.company_id], enabled, queryFn: async () => { const r = await supabase.from("member_skills").select("user_id,skill_id"); if (r.error) throw r.error; return r.data; } });
  if (!enabled) return null;
  const all = (skills.data ?? []).filter(s => !s.archived); const has = (id: string) => (links.data ?? []).some(l => l.user_id === userId && l.skill_id === id);
  const canEdit = editable && isManager(profile);
  const toggle = async (id: string) => {
    if (!profile || busy) return; setBusy(id);
    try { const r = has(id) ? await supabase.from("member_skills").delete().eq("user_id", userId).eq("skill_id", id) : await supabase.from("member_skills").insert({ company_id: profile.company_id, user_id: userId, skill_id: id }); if (r.error) throw r.error; await qc.invalidateQueries({ queryKey: ["member-skills"] }); }
    catch(e) { toast.error(e instanceof Error ? e.message : "Could not update skills"); } finally { setBusy(null); }
  };
  return <div className="mt-2 space-y-2">
    <div className="flex flex-wrap items-center gap-1.5">{all.filter(s => has(s.id)).map(s => <span key={s.id} className="rounded border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{s.name}</span>)}{!links.isPending && !all.some(s => has(s.id)) && <span className="text-xs text-muted-foreground">No skills assigned</span>}{canEdit && <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Edit skills</Button>}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Skills — {name}</DialogTitle></DialogHeader>
      {skills.isError || links.isError ? <p role="alert" className="text-destructive">Could not load skills.</p> : skills.isPending || links.isPending ? <p role="status">Loading skills…</p> : all.length === 0 ? <p className="text-muted-foreground">No active company skills.</p> : <div className="max-h-96 space-y-3 overflow-y-auto">{all.map(s => <label key={s.id} className="flex items-center gap-3 text-sm"><Checkbox checked={has(s.id)} disabled={busy !== null} onCheckedChange={() => void toggle(s.id)} /><span>{s.category && <span className="text-muted-foreground">{s.category} · </span>}{s.name}</span></label>)}</div>}
      <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
    </DialogContent></Dialog>
  </div>;
}