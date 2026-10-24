import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { MemberSkills } from "@/components/member-skills";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isManager, useProfile, ROLE_LABEL, type Role } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";
import { activeSkillMember, assignedSkills, FIELD_TRADES, groupSkills, matchesTrade } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/skills")({ staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Skills & specialties — FieldBridge" },
    { name: "description", content: "Manage categorized company skills and individual field staff qualifications for dispatch." },
    { property: "og:title", content: "Skills & specialties — FieldBridge" },
    { property: "og:description", content: "Company skill categories and individual team assignments." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: SkillsPage,
});

type Skill = { id: string; name: string; category: string; archived: boolean };

function SkillsPage() {
  const { data: p } = useProfile();
  const feature = usePlanFeatures(!!p);
  const qc = useQueryClient();
  const manager = isManager(p);
  const enabled = manager && feature("skills_dispatch");
  const skills = useQuery({ queryKey: ["company-skills", p?.company_id], enabled, queryFn: async () => {
    const r = await supabase.from("company_skills").select("id,name,category,archived").order("category").order("name");
    if (r.error) throw r.error; return r.data;
  } });
  const links = useQuery({ queryKey: ["member-skills", p?.company_id], enabled, queryFn: async () => {
    const r = await supabase.from("member_skills").select("user_id,skill_id"); if (r.error) throw r.error; return r.data;
  } });
  const users = useQuery({ queryKey: ["skill-members", p?.id, p?.company_id], enabled, queryFn: async () => {
    const [u, r] = await Promise.all([
      supabase.from("users").select("id,full_name").order("full_name"),
      supabase.from("user_roles").select("user_id,role,registration_status").eq("registration_status", "active"),
    ]);
    if (u.error || r.error) throw u.error || r.error;
    return (u.data ?? []).flatMap(user => {
      const role = r.data?.find(row => row.user_id === user.id);
      return role && activeSkillMember(role.role, role.registration_status) ? [{ ...user, role: role.role as Role }] : [];
    });
  } });
  const [name, setName] = useState(""); const [category, setCategory] = useState("");
  const [showDeleted, setShowDeleted] = useState(false); const [trade, setTrade] = useState("all");
  const [search, setSearch] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null); const [deleting, setDeleting] = useState<Skill | null>(null);
  const [editName, setEditName] = useState(""); const [editCategory, setEditCategory] = useState("");
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["company-skills"] }), qc.invalidateQueries({ queryKey: ["member-skills"] })]); };
  const mutate = async (action: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    if (!p || !enabled || busy) return false;
    setBusy(true);
    try { const r = await action(); if (r.error) throw new Error(r.error.message); await refresh(); toast.success(success); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not update skills"); return false; }
    finally { setBusy(false); }
  };
  if (!p) return <AppShell title="Skills & specialties"><p role="status">Loading…</p></AppShell>;
  if (!manager) return <AppShell title="Skills & specialties"><EmptyState>Skills management is available to supervisors and office staff.</EmptyState></AppShell>;
  if (!enabled) return <AppShell title="Skills & specialties"><EmptyState>Skills & Smart Dispatch is not in your plan. Ask your company owner to add this module from Billing & Plan.</EmptyState></AppShell>;
  const all = skills.data ?? []; const active = all.filter(s => !s.archived);
  const members = (users.data ?? []).filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()) && matchesTrade(assignedSkills(active, links.data ?? [], u.id).map(s => s.name), trade === "all" ? "" : trade));
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (!name.trim()) return;
    if (await mutate(() => supabase.from("company_skills").insert({ company_id: p.company_id, name: name.trim(), category: category.trim() }), "Skill added")) setName("");
  };
  return <AppShell title="Skills & specialties"><div className="space-y-7">
    <section className="space-y-4 border-b pb-6">
      <h2 className="text-lg font-semibold">Company skills</h2>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5"><Label htmlFor="skill-name">Skill</Label><Input id="skill-name" required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welding" /></div>
        <div className="space-y-1.5"><Label htmlFor="skill-cat">Category (optional)</Label><Input id="skill-cat" list="skill-categories" maxLength={40} value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Trades, Certifications" /><datalist id="skill-categories">{[...new Set(active.map(s => s.category).filter(Boolean))].map(c => <option key={c} value={c} />)}</datalist></div>
        <Button type="submit" className="self-end" disabled={busy || !name.trim()}>Add skill</Button>
      </form>
      {skills.isPending ? <p role="status">Loading skills…</p> : skills.isError ? <p role="alert" className="text-destructive">Could not load company skills.</p> : groupSkills(all.filter(s => showDeleted || !s.archived)).map(([group, rows]) => <div key={group} className="space-y-2"><h3 className="text-sm font-medium text-muted-foreground">{group}</h3><ul className="divide-y rounded-lg border">{rows.map(s => <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2"><span className={`min-w-0 break-words text-sm ${s.archived ? "text-muted-foreground line-through" : ""}`}>{s.name}</span><div className="flex shrink-0 gap-1">{s.archived ? <Button variant="ghost" size="icon" title={`Restore ${s.name}`} aria-label={`Restore ${s.name}`} disabled={busy} onClick={() => void mutate(() => supabase.from("company_skills").update({ archived: false }).eq("id", s.id), "Skill restored")}><RotateCcw className="h-4 w-4" /></Button> : <><Button variant="ghost" size="icon" title={`Edit ${s.name}`} aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setEditName(s.name); setEditCategory(s.category); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={`Delete ${s.name}`} aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button></>}</div></li>)}</ul></div>)}
      {!skills.isPending && !skills.isError && !active.length && <p className="text-sm text-muted-foreground">No active company skills.</p>}
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={showDeleted} onCheckedChange={v => setShowDeleted(v === true)} />Show removed skills</label>
    </section>
    <section className="space-y-4"><h2 className="text-lg font-semibold">Team skills</h2>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="skill-member-search">Team member</Label><Input id="skill-member-search" placeholder="Search team members" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="team-trade">Field staff trade</Label><Select value={trade} onValueChange={setTrade}><SelectTrigger id="team-trade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All trades</SelectItem>{FIELD_TRADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div></div>
      {users.isPending || links.isPending ? <p role="status">Loading team skills…</p> : users.isError || links.isError ? <p role="alert" className="text-destructive">Could not load team skills.</p> : <div className="grid gap-3 sm:grid-cols-2">{members.map(u => <div key={u.id} className="rounded-lg border bg-card p-4"><h3 className="break-words font-medium">{u.full_name}</h3><p className="text-xs text-muted-foreground">{ROLE_LABEL[u.role]}</p><MemberSkills userId={u.id} role={u.role} name={u.full_name} editable /></div>)}{!members.length && <p className="text-sm text-muted-foreground">No matching active field staff.</p>}</div>}
    </section>
    <Dialog open={!!editing} onOpenChange={v => { if (!v && !busy) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>Edit skill</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async e => { e.preventDefault(); if (!editing || !editName.trim()) return; if (await mutate(() => supabase.from("company_skills").update({ name: editName.trim(), category: editCategory.trim() }).eq("id", editing.id), "Skill updated")) setEditing(null); }}><div className="space-y-1.5"><Label htmlFor="edit-skill-name">Skill</Label><Input id="edit-skill-name" required maxLength={60} value={editName} onChange={e => setEditName(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="edit-skill-category">Category (optional)</Label><Input id="edit-skill-category" list="skill-categories" maxLength={40} value={editCategory} onChange={e => setEditCategory(e.target.value)} /></div><Button disabled={busy || !editName.trim()} type="submit">Save</Button></form></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={v => { if (!v && !busy) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Delete {deleting?.name}?</DialogTitle><DialogDescription>This removes the skill from current assignment lists. Historical job requirements and previous assignments are retained.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async () => { if (!deleting) return; if (await mutate(() => supabase.from("company_skills").update({ archived: true }).eq("id", deleting.id), "Skill removed")) setDeleting(null); }}>Delete skill</Button></div></DialogContent></Dialog>
  </div></AppShell>;
}
