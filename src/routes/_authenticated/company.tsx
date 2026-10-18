import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isOffice, ROLE_LABEL, type Role } from "@/lib/profile";
import { MODULES, ROLES, canSee, usePermRows, useCan, type ModuleKey } from "@/lib/permissions";
import { useCompanyRules, FONT_CHOICES, applyTypography, DEFAULT_THEME, type Typography, type TextStyle } from "@/lib/company";
import { PhoneInput, splitPhone } from "@/components/client-manager";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentSettings } from "@/components/document-settings";
import { DocumentLibrary } from "@/components/document-library";
import { IntegrationsSettings } from "@/components/integrations-settings";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/company")({
  head: () => ({
    meta: [
      { title: "Company settings — FieldOps" },
      { name: "description", content: "Working hours, overtime rules, role access and team invites for your company." },
      { property: "og:title", content: "Company settings — FieldOps" },
      { property: "og:description", content: "Working hours, overtime, role access and team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CompanyPage() {
  const { data: profile } = useProfile();
  const can = useCan(profile);
  if (!profile) return <AppShell title="Company"><p className="text-muted-foreground">Loading…</p></AppShell>;
  const office = isOffice(profile);
  const superuser = profile.role === "superuser";
  const team = can("team");
  const def = office ? "hours" : "team";
  return (
    <AppShell title="Company settings">
      <Tabs defaultValue={def} className="mx-auto max-w-5xl">
        <TabsList className="h-auto flex-wrap">
          {office && <TabsTrigger value="hours">Hours & overtime</TabsTrigger>}
          {office && <TabsTrigger value="profile">Profile & branding</TabsTrigger>}
          {office && <TabsTrigger value="documents">PDF & terms</TabsTrigger>}
          {office && <TabsTrigger value="library">Document library</TabsTrigger>}
          {office && <TabsTrigger value="messaging">Messages & emails</TabsTrigger>}
          {office && <TabsTrigger value="integrations">Accounting</TabsTrigger>}
          {team && <TabsTrigger value="team">Team & invites</TabsTrigger>}
          {superuser && <TabsTrigger value="access">Role access</TabsTrigger>}
        </TabsList>
        {office && <TabsContent value="hours" className="mt-4"><HoursTab companyId={profile.company_id} /></TabsContent>}
        {office && <TabsContent value="profile" className="mt-4"><ProfileTab companyId={profile.company_id} /></TabsContent>}
        {office && <TabsContent value="documents" className="mt-4"><DocumentSettings companyId={profile.company_id} /></TabsContent>}
        {office && <TabsContent value="library" className="mt-4"><DocumentLibrary companyId={profile.company_id} userId={profile.id} /></TabsContent>}
        {office && <TabsContent value="integrations" className="mt-4"><IntegrationsSettings part="accounting" companyId={profile.company_id} /></TabsContent>}
        {office && <TabsContent value="messaging" className="mt-4"><IntegrationsSettings part="messaging" companyId={profile.company_id} /></TabsContent>}
        {team && <TabsContent value="team" className="mt-4"><TeamTab role={profile.role} companyId={profile.company_id} meId={profile.id} /></TabsContent>}
        {superuser && <TabsContent value="access" className="mt-4"><AccessTab companyId={profile.company_id} /></TabsContent>}
      </Tabs>
    </AppShell>
  );
}

function HoursTab({ companyId }: { companyId: string }) {
  const { data } = useCompanyRules();
  const qc = useQueryClient();
  const [f, setF] = useState<null | { work_days: number[]; work_start: string; work_end: string; after_hours_rate: number; saturday_rate: number; sunday_rate: number; holiday_rate: number; holidays: string; renewal_notice_days: number; industry: string; idle_timeout_minutes: number; break_enabled: boolean; breaks_per_shift: number; break_minutes: number }>(null);
  useEffect(() => {
    if (data && !f) setF({ ...data.rules, holidays: data.rules.public_holidays.join(", "), renewal_notice_days: data.renewalDays, industry: data.industry, idle_timeout_minutes: data.idleTimeout, break_enabled: data.breaks.enabled, breaks_per_shift: data.breaks.count, break_minutes: data.breaks.minutes });
  }, [data, f]);
  if (!f) return null;
  const save = async () => {
    const holidays = f.holidays.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean);
    if (holidays.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) { toast.error("Public holidays must be dates like 2026-12-25"); return; }
    if (f.work_end <= f.work_start) { toast.error("Closing time must be after opening time"); return; }
    const { holidays: _h, ...rest } = f;
    const { error } = await supabase.from("company_settings").upsert({ ...rest, public_holidays: holidays, company_id: companyId });
    if (error) { toast.error(error.message); return; }
    toast.success("Company hours saved");
    qc.invalidateQueries({ queryKey: ["company-settings"] });
  };
  const rate = (k: "after_hours_rate" | "saturday_rate" | "sunday_rate" | "holiday_rate", l: string) => (
    <div className="space-y-1.5"><Label>{l}</Label>
      <Select value={String(f[k])} onValueChange={(v) => setF({ ...f, [k]: Number(v) })}>
        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
        <SelectContent>{["1", "1.5", "2"].map((r) => <SelectItem key={r} value={r}>{r}×</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  return (
    <section className="space-y-5 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-medium text-foreground">Opening hours</h2>
        <p className="text-sm text-muted-foreground">Time logged on job sheets inside these hours counts as standard (1.0×). Everything else is overtime.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {DAYS.map((d, i) => {
          const on = f.work_days.includes(i);
          return <Button key={d} type="button" size="sm" variant={on ? "default" : "outline"} onClick={() => setF({ ...f, work_days: on ? f.work_days.filter((x) => x !== i) : [...f.work_days, i].sort() })}>{d}</Button>;
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Opens</Label><Input className="h-11" type="time" step={900} value={f.work_start} onChange={(e) => setF({ ...f, work_start: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Closes</Label><Input className="h-11" type="time" step={900} value={f.work_end} onChange={(e) => setF({ ...f, work_end: e.target.value })} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {rate("after_hours_rate", "Weekday after hours")}
        {rate("saturday_rate", "Saturday")}
        {rate("sunday_rate", "Sunday")}
        {rate("holiday_rate", "Public holiday")}
      </div>
      <div className="space-y-1.5"><Label>Public holidays (dates, comma separated)</Label><Input className="h-11" placeholder="2026-12-25, 2026-12-26" value={f.holidays} onChange={(e) => setF({ ...f, holidays: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Contract renewal reminder (days before expiry)</Label><Input className="h-11" type="number" min={1} value={f.renewal_notice_days} onChange={(e) => setF({ ...f, renewal_notice_days: Number(e.target.value) || 30 })} /></div>
        <div className="space-y-1.5"><Label>Line of work</Label><Input className="h-11" placeholder="e.g. Lifts & escalators" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></div>
      </div>
      <div className="space-y-1.5 sm:max-w-xs"><Label>Auto sign-out after inactivity</Label>
        <Select value={String(f.idle_timeout_minutes)} onValueChange={(v) => setF({ ...f, idle_timeout_minutes: Number(v) })}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{[[0,"Off"],[15,"15 minutes"],[30,"30 minutes"],[60,"1 hour"],[120,"2 hours"],[180,"3 hours"]].map(([v,l]) => <SelectItem key={v} value={String(v)}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Technicians who are clocked in are never signed out.</p>
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={f.break_enabled} onCheckedChange={(c) => setF({ ...f, break_enabled: c })} />Mandatory breaks & mid-shift reminder</label>
        <p className="text-xs text-muted-foreground">Breaks always show as taken on the daily works report, even if the technician didn't press anything. Shifts under 4 hours get no break.</p>
        {f.break_enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Breaks per shift</Label><Input className="h-11" type="number" min={1} max={4} value={f.breaks_per_shift} onChange={(e) => setF({ ...f, breaks_per_shift: Math.min(4, Math.max(1, Number(e.target.value) || 1)) })} /></div>
            <div className="space-y-1.5"><Label>Minutes per break</Label><Input className="h-11" type="number" min={5} max={120} step={5} value={f.break_minutes} onChange={(e) => setF({ ...f, break_minutes: Math.min(120, Math.max(5, Number(e.target.value) || 30)) })} /></div>
          </div>
        )}
      </div>
      <Button className="h-11" onClick={save}>Save hours & rules</Button>
    </section>
  );
}

type Phones = { office_phone: string; whatsapp_phone: string; emergency_phone: string; company_email: string; company_address: string; pe_number: string };

/** Shrinks an image to fit 400×400 and returns a PNG data URL, so it embeds in PDFs and emails. */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 400 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("That file isn't a readable image"));
    img.src = URL.createObjectURL(file);
  });
}

function LogoCard({ companyId, current }: { companyId: string; current: string }) {
  const qc = useQueryClient();
  const save = async (logo_data: string | null) => {
    const { error } = await supabase.from("company_settings").upsert({ company_id: companyId, logo_data });
    if (error) { toast.error(error.message); return; }
    toast.success(logo_data ? "Logo saved" : "Logo removed");
    qc.invalidateQueries({ queryKey: ["company-settings"] });
  };
  const pick = async (f?: File) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Logo must be under 5 MB"); return; }
    try { await save(await shrinkImage(f)); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div><h2 className="font-medium text-foreground">Company logo</h2><p className="text-sm text-muted-foreground">Shown in the menu, on client job sheet PDFs and the sign-off screen. PNG, JPG, SVG or WebP.</p></div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed bg-muted/40">
          {current ? <img src={current} alt="Company logo" className="max-h-full max-w-full object-contain p-1" /> : <span className="text-xs text-muted-foreground">No logo</span>}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="h-11"><label className="cursor-pointer">{current ? "Change logo" : "Upload logo"}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>
          {current && <Button variant="ghost" className="h-11" onClick={() => save(null)}>Remove</Button>}
        </div>
      </div>
    </section>
  );
}

function ProfileTab({ companyId }: { companyId: string }) {
  const { data } = useCompanyRules();
  const qc = useQueryClient();
  const [p, setP] = useState<Phones | null>(null);
  const [t, setT] = useState<Typography | null>(null);
  useEffect(() => { if (data && !p) { setP({...data.phones,pe_number:data.peNumber}); setT(data.theme); } }, [data, p]);
  useEffect(() => { if (t) applyTypography(t); }, [t]);
  if (!p || !t) return null;
  const save = async () => {
    const { error } = await supabase.from("company_settings").upsert({ company_id: companyId, ...p, theme: t as never });
    if (error) { toast.error(error.message); return; }
    toast.success("Company profile saved");
    qc.invalidateQueries({ queryKey: ["company-settings"] });
  };
  const phone = (k: "office_phone" | "whatsapp_phone" | "emergency_phone", l: string, hint?: string) => {
    const sp = splitPhone(p[k]);
    return (
      <div className="space-y-1.5"><Label>{l}</Label>
        <PhoneInput code={sp.code} number={sp.number} onChange={(c, n) => setP({ ...p, [k]: n.trim() ? `${c} ${n}` : "" })} />
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  };
  const style = (k: keyof Typography, l: string) => {
    const v = t[k];
    const up = (patch: Partial<TextStyle>) => setT({ ...t, [k]: { ...v, ...patch } });
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <p className="font-medium text-foreground">{l}</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Select value={v.font} onValueChange={(f) => up({ font: f })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_CHOICES.map((f) => <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.css || undefined }}>{f.label}</span></SelectItem>)}</SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="color" aria-label={`${l} colour`} className="h-11 w-14 p-1" value={v.color || "#000000"} onChange={(e) => up({ color: e.target.value })} />
            <Button type="button" size="sm" variant="ghost" onClick={() => up({ color: "" })}>Default colour</Button>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={v.bold} onCheckedChange={(c) => up({ bold: !!c })} /><b>Bold</b></label>
          <label className="flex items-center gap-2"><Checkbox checked={v.italic} onCheckedChange={(c) => up({ italic: !!c })} /><i>Italic</i></label>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <LogoCard companyId={companyId} current={data?.logo ?? ""} />
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Company contact details</h2><p className="text-sm text-muted-foreground">Shown to clients on job sheets and in "on the way" messages.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {phone("office_phone", "Office phone")}
          {phone("whatsapp_phone", "WhatsApp dispatch number", "Clients see this number on WhatsApp updates.")}
          {phone("emergency_phone", "24/7 emergency line")}
          <div className="space-y-1.5"><Label>Company email</Label><Input className="h-11" type="email" value={p.company_email} onChange={(e) => setP({ ...p, company_email: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="company-pe-number">PE number (Principal Employer)</Label><Input id="company-pe-number" value={p.pe_number} onChange={e=>setP({...p,pe_number:e.target.value})}/></div>
        <div className="space-y-1.5"><Label>Office address</Label><Input className="h-11" value={p.company_address} onChange={(e) => setP({ ...p, company_address: e.target.value })} /></div>
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Fonts</h2><p className="text-sm text-muted-foreground">Changes preview live across the app. Save to apply for everyone in your company.</p></div>
        <div className="grid gap-4 md:grid-cols-2">{style("headers", "Headers & titles")}{style("fields", "Field labels")}</div>
        <Button type="button" variant="outline" size="sm" onClick={() => setT(DEFAULT_THEME)}>Reset fonts</Button>
      </section>
      <Button className="h-11" onClick={save}>Save profile & branding</Button>
    </div>
  );
}

const invitable = (r: Role): Role[] => r === "superuser" ? ["technician", "supervisor", "admin", "superuser"] : r === "admin" ? ["technician", "supervisor", "admin"] : ["technician", "supervisor"];

function TeamTab({ role, companyId, meId }: { role: Role; companyId: string; meId: string }) {
  const qc = useQueryClient();
  const [inv, setInv] = useState({ role: "technician" as Role, full_name: "", email: "" });
  const canEditRoles = role === "superuser" || role === "admin";
  const { data } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [u, r, i] = await Promise.all([
        supabase.from("users").select("id, full_name, email, employee_id").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("company_invites").select("*").is("used_at", null).order("created_at", { ascending: false }),
      ]);
      return { users: u.data ?? [], roles: new Map((r.data ?? []).map((x) => [x.user_id, x.role as Role])), invites: i.data ?? [] };
    },
  });
  const link = (t: string) => `${window.location.origin}/join/${t}`;
  const copy = async (t: string) => { await navigator.clipboard.writeText(link(t)); toast.success("Invite link copied"); };
  const create = async () => {
    const { data: row, error } = await supabase.from("company_invites").insert({ company_id: companyId, role: inv.role, full_name: inv.full_name || null, email: inv.email || null }).select("token").single();
    if (error) { toast.error(error.message); return; }
    await copy(row.token).catch(() => toast.success("Invite link created"));
    setInv({ ...inv, full_name: "", email: "" });
    qc.invalidateQueries({ queryKey: ["team"] });
  };
  const revoke = async (id: string) => {
    const { error } = await supabase.from("company_invites").delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["team"] });
  };
  const changeRole = async (userId: string, r: Role) => {
    const { error } = await supabase.from("user_roles").update({ role: r }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["team"] });
  };
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-medium text-foreground"><Link2 className="h-4 w-4" />Create a join link</h2>
        <p className="text-sm text-muted-foreground">Send the link to a new team member. They pick a password and join with the role you choose. Links expire after 14 days and work once. Employee IDs are created automatically.</p>
        <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Select value={inv.role} onValueChange={(v) => setInv({ ...inv, role: v as Role })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{invitable(role).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-11" placeholder="Name (optional)" value={inv.full_name} onChange={(e) => setInv({ ...inv, full_name: e.target.value })} />
          <Input className="h-11" type="email" placeholder="Email (optional)" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />
          <Button className="h-11" onClick={create}>Create & copy link</Button>
        </div>
        {data?.invites.length ? (
          <ul className="divide-y rounded-lg border">
            {data.invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{i.full_name || i.email || "Open invite"} · {ROLE_LABEL[i.role as Role]} · expires {new Date(i.expires_at).toLocaleDateString()}</span>
                <Button size="sm" variant="outline" onClick={() => copy(i.token)}><Copy className="mr-1 h-3.5 w-3.5" />Copy</Button>
                <Button size="icon" variant="ghost" aria-label="Revoke invite" onClick={() => revoke(i.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-5 py-3 font-medium text-foreground">Team ({data?.users.length ?? 0})</h2>
        {!data?.users.length ? <div className="p-5"><EmptyState>No team members yet.</EmptyState></div> : (
          <ul className="divide-y">
            {data.users.map((u) => {
              const r = data.roles.get(u.id) ?? "technician";
              const editable = canEditRoles && u.id !== meId && (role === "superuser" || r !== "superuser");
              return (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{u.full_name} <span className="font-mono text-xs text-muted-foreground">{u.employee_id}</span></p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
                  {canEditRoles && <Button asChild size="sm" variant="outline"><Link to="/payroll/wages">Payroll setup</Link></Button>}
                  {editable ? (
                    <Select value={r} onValueChange={(v) => changeRole(u.id, v as Role)}>
                      <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{invitable(role).map((x) => <SelectItem key={x} value={x}>{ROLE_LABEL[x]}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <span className="text-sm text-muted-foreground">{ROLE_LABEL[r]}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function AccessTab({ companyId }: { companyId: string }) {
  const { data: rows = [] } = usePermRows();
  const qc = useQueryClient();
  const toggle = async (role: Role, module: ModuleKey, enabled: boolean) => {
    const { error } = await supabase.from("role_permissions").upsert({ company_id: companyId, role, module, enabled });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["role-permissions"] });
  };
  const roles = ROLES.filter((r) => r !== "superuser");
  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b px-5 py-3">
        <h2 className="font-medium text-foreground">What each role can see</h2>
        <p className="text-sm text-muted-foreground">Turn sections on or off for each role. The Company Superuser always sees everything. Use “View as” in the top bar to preview.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="px-5 py-2 font-medium">Section</th>{roles.map((r) => <th key={r} className="px-3 py-2 text-center font-medium">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody className="divide-y">
            {MODULES.map((m) => (
              <tr key={m.key}>
                <td className="px-5 py-2.5 text-foreground">{m.label}</td>
                {roles.map((r) => <td key={r} className="px-3 py-2.5 text-center"><Switch aria-label={`${m.label} for ${ROLE_LABEL[r]}`} checked={canSee(r, m.key, rows)} onCheckedChange={(c) => toggle(r, m.key, c)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
