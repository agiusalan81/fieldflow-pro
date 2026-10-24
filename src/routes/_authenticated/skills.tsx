import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isManager, useProfile, useCompanyUsers } from "@/lib/profile";
import { usePlanFeatures } from "@/lib/plan-features";

export const Route = createFileRoute("/_authenticated/skills")({ staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Skills & specialties — FieldBridgeApp" },
    { name: "description", content: "Create your company's own skills and assign them to technicians and supervisors." },
    { property: "og:title", content: "Skills & specialties — FieldBridgeApp" },
    { property: "og:description", content: "Custom skills catalogue for smart dispatch." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SkillsPage,
});

type Skill = { id: string; name: string; category: string; archived: boolean };

function SkillsPage() {
  const { data: p } = useProfile();
  const feature = usePlanFeatures(!!p);
  const qc = useQueryClient();
  const manager = isManager(p);
  const { data: users = [] } = useCompanyUsers();
  const skills = useQuery({ queryKey: ["company-skills"], enabled:feature("skills_dispatch"), queryFn: async () => { const r = await supabase.from("company_skills").select("id,name,category,archived").order("category").order("name"); if (r.error) throw r.error; return r.data as Skill[]; } });
  const links = useQuery({ queryKey: ["member-skills"], enabled:feature("skills_dispatch"), queryFn: async () => { const r = await supabase.from("member_skills").select("user_id,skill_id"); if (r.error) throw r.error; return r.data; } });
  const [name, setName] = useState(""); const [category, setCategory] = useState(""); const [showArchived, setShowArchived] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["company-skills"] }); qc.invalidateQueries({ queryKey: ["member-skills"] }); };

  if (!feature("skills_dispatch")) return <AppShell title="Skills & specialties"><EmptyState>Skills & Smart Dispatch is not in your plan. Ask your company owner to add this module from Billing & Plan.</EmptyState></AppShell>;

  const all = skills.data ?? [];
  const active = all.filter(s => !s.archived);
  const has = (u: string, s: string) => (links.data ?? []).some(l => l.user_id === u && l.skill_id === s);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (!name.trim() || !p) return;
    const r = await supabase.from("company_skills").insert({ company_id: p.company_id, name: name.trim(), category: category.trim() });
    if (r.error) { toast.error(r.error.message.includes("company_skills_name_uq") ? "That skill already exists" : r.error.message); return; }
    setName(""); toast.success("Skill added"); refresh();
  };
  const rename = async (s: Skill) => { const n = window.prompt("Rename skill", s.name)?.trim(); if (!n || n === s.name) return; const r = await supabase.from("company_skills").update({ name: n }).eq("id", s.id); if (r.error) toast.error(r.error.message); else refresh(); };
  const archive = async (s: Skill) => { const r = await supabase.from("company_skills").update({ archived: !s.archived }).eq("id", s.id); if (r.error) toast.error(r.error.message); else refresh(); };
  const toggle = async (u: string, s: string) => {
    if (!p) return;
    const r = has(u, s) ? await supabase.from("member_skills").delete().eq("user_id", u).eq("skill_id", s) : await supabase.from("member_skills").insert({ company_id: p.company_id, user_id: u, skill_id: s });
    if (r.error) toast.error(r.error.message); else refresh();
  };

  if (!manager) {
    const mine = active.filter(s => p && has(p.id, s.id));
    return <AppShell title="My skills"><div className="space-y-3"><p className="text-sm text-muted-foreground">Your supervisor or office assigns these. They decide which open jobs you can claim.</p>
      {mine.length ? <div className="flex flex-wrap gap-2">{mine.map(s => <span key={s.id} className="rounded-full border bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">{s.name}</span>)}</div> : <EmptyState>No skills assigned yet. Ask your supervisor to add your skills.</EmptyState>}
    </div></AppShell>;
  }

  const members = users.filter(u => ["technician","supervisor","maintenance"].includes(u.role));
  return (
    <AppShell title="Skills & specialties">
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div><h2 className="font-medium">Company skills</h2><p className="text-sm text-muted-foreground">Add your own skills, e.g. Electrical, Plumbing, CCTV, Welding, IT, Mechanical, Installation. Group them with an optional category.</p></div>
          <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1"><Label htmlFor="skill-name">Skill</Label><Input id="skill-name" className="h-11" maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welding" /></div>
            <div className="space-y-1"><Label htmlFor="skill-cat">Category (optional)</Label><Input id="skill-cat" className="h-11" maxLength={40} value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Technical" /></div>
            <Button type="submit" className="h-11 self-end">Add skill</Button>
          </form>
          <div className="flex flex-wrap gap-2">{all.filter(s => showArchived || !s.archived).map(s => <span key={s.id} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${s.archived ? "opacity-60" : ""}`}>
            {s.category && <span className="text-muted-foreground">{s.category} ·</span>}{s.name}
            <button type="button" className="ml-1 text-xs text-primary underline" onClick={() => rename(s)}>Rename</button>
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => archive(s)}>{s.archived ? "Restore" : "Archive"}</button>
          </span>)}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Show archived</label>
        </section>
        <section className="space-y-3">
          <h2 className="font-medium">Team skills</h2>
          {!active.length ? <EmptyState>Add a skill first. Then tap skills under each person to assign them.</EmptyState> : members.map(u => (
            <div key={u.id} className="rounded-xl border bg-card p-4">
              <p className="font-medium">{u.full_name} <span className="text-xs capitalize text-muted-foreground">· {u.role}</span></p>
              <div className="mt-2 flex flex-wrap gap-2">{active.map(s => { const on = has(u.id, s.id); return <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(u.id, s.id)} className={`min-h-9 rounded-full border px-3 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground"}`}>{on ? "✓ " : ""}{s.name}</button>; })}</div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
