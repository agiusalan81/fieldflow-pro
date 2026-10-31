import { FieldsEditor } from "@/components/fields-editor";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/lib/permissions";
import { NumberingSettings } from "@/components/numbering-settings";
import { ClientBillingSettings } from '@/components/client-billing-settings';
import { expandServices } from '@/lib/operating-services';
import { OperatingServices } from '@/components/operating-services';
import { IdentifierSettings } from '@/components/identifier-settings';
import { settingsSectionPatch } from "@/lib/settings-sections";
import { TechnicalStructure } from "@/components/technical-structure";
import { CrmSettings } from "@/components/crm-settings";
import { EstimateSettings } from "@/components/estimate-settings";
import { QuoteAcceptanceSetting } from "@/components/quote-acceptance-setting";
import { PriceListSettings } from "@/components/price-list-settings";
import { InventoryControlSettings } from "@/components/tool-register";
import { ClaimIncentiveSettings } from "@/components/claim-incentive-settings";
import { VehicleCompanySettings } from "@/components/vehicle-settings";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, isOffice, ROLE_LABEL, type Role } from "@/lib/profile";
import { usePlanFeatures, useEdition } from "@/lib/plan-features";
import { SpaceConfigurator } from "@/components/space-configurator";
import { MODULES, ROLES, canSee, usePermRows, type ModuleKey } from "@/lib/permissions";
import { useCompanyRules, FONT_CHOICES, applyTypography, DEFAULT_THEME, type Typography, type TextStyle } from "@/lib/company";
import { PhoneInput, splitPhone, COUNTRIES } from "@/components/client-manager";
import { formatOfficeAddress, type OfficeAddress } from "@/lib/contact-details";
import { CURRENCIES } from "@/lib/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentSettings } from "@/components/document-settings";
import { DocumentLibrary } from "@/components/document-library";
import { useCompanyTitle } from "@/lib/company-name";
import { SafetySettings } from "@/components/safety-settings";
import { IntegrationsSettings } from "@/components/integrations-settings";
import { HoursExportSettings } from "@/components/hours-export-settings";
import { AppShell, EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppearanceSettings } from "@/components/appearance-settings";
import { INDUSTRY_PRESETS, INDUSTRY_LABELS, type Appearance } from "@/lib/branding";
import { BrandingLock } from "@/components/branding-lock";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/company")({ staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): { section?: string } => ({ section: typeof s["section"] === "string" ? s["section"] : "profile" }),
  head: () => ({
    meta: [
      { title: "Company settings — FieldBridge" },
      { name: "description", content: "Working hours, overtime rules, role access and branding for your company." },
      { property: "og:title", content: "Company settings — FieldBridge" },
      { property: "og:description", content: "Working hours, overtime, role access and branding." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CompanyPage() {
  const { data: profile } = useProfile();
  if (!profile) return <AppShell title="Company"><p className="text-muted-foreground">Loading…</p></AppShell>;
  const office = isOffice(profile);
  const superuser = profile.role === "superuser";
  if (!office) return <AppShell title="Company settings"><EmptyState>Company settings are available to office staff.</EmptyState></AppShell>;
  return (
    <AppShell title="Company settings">
      <SettingsSections superuser={superuser} companyId={profile.company_id} userId={profile.id} role={profile.role} />
    </AppShell>
  );
}

function HoursTab({ companyId }: { companyId: string }) {
  const { data } = useCompanyRules();
  const qc = useQueryClient();
  const [f, setF] = useState<null | { work_days: number[]; work_start: string; work_end: string; after_hours_rate: number; saturday_rate: number; sunday_rate: number; holiday_rate: number; holidays: string; renewal_notice_days: number; idle_timeout_minutes: number; location_ping_seconds: number; break_enabled: boolean; breaks_per_shift: number; break_minutes: number; currency: string; default_country_code: string; equipment_label: string; equipment_categories: string; field_sheet_history_months:number }>(null);
  useEffect(() => {
    if (data && !f) setF({ ...data.rules, holidays: data.rules.public_holidays.join(", "), renewal_notice_days: data.renewalDays, idle_timeout_minutes: data.idleTimeout, location_ping_seconds: data.pingSeconds, break_enabled: data.breaks.enabled, breaks_per_shift: data.breaks.count, break_minutes: data.breaks.minutes, currency: data.locale.currency, default_country_code: data.locale.countryCode, equipment_label: data.locale.equipmentLabel, equipment_categories: data.equipmentCategories.join(", "), field_sheet_history_months:data.fieldSheetHistoryMonths });
  }, [data, f]);
  if (!f) return null;
  const save = async () => {
    const holidays = f.holidays.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean);
    if (holidays.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) { toast.error("Public holidays must be dates like 2026-12-25"); return; }
    if (f.work_end <= f.work_start) { toast.error("Closing time must be after opening time"); return; }
    const { holidays: _h, equipment_categories: cats, ...rest } = f;
    const equipment_categories = cats.split(",").map((c) => c.trim()).filter(Boolean);
    if (!/^\+\d{1,4}$/.test(f.default_country_code)) { toast.error("Country code must look like +356"); return; }
    const { error } = await supabase.from("company_settings").upsert({ ...rest, equipment_categories, public_holidays: holidays, company_id: companyId });
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
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="text-sm font-medium">Region & wording</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Currency</Label>
            <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Default phone country</Label>
            <Select value={f.default_country_code} onValueChange={(v) => setF({ ...f, default_country_code: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{COUNTRIES.map(([c, n]) => <SelectItem key={c + n} value={c}>{n} ({c})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Equipment word on client notes</Label><Input className="h-11" placeholder="lift, chiller, boiler…" value={f.equipment_label} onChange={(e) => setF({ ...f, equipment_label: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Equipment types (comma separated)</Label><Input className="h-11" placeholder="Elevator, Escalator, Custom" value={f.equipment_categories} onChange={(e) => setF({ ...f, equipment_categories: e.target.value })} /></div>
      </div>
      <div className="space-y-1.5 sm:max-w-xs"><Label>Auto sign-out after inactivity</Label>
        <Select value={String(f.idle_timeout_minutes)} onValueChange={(v) => setF({ ...f, idle_timeout_minutes: Number(v) })}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{[[0,"Off"],[15,"15 minutes"],[30,"30 minutes"],[60,"1 hour"],[120,"2 hours"],[180,"3 hours"]].map(([v,l]) => <SelectItem key={v} value={String(v)}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Technicians who are clocked in are never signed out.</p>
      </div>
      <div className="space-y-1.5 sm:max-w-xs"><Label>GPS update while clocked in</Label>
        <Select value={String(f.location_ping_seconds)} onValueChange={(v) => setF({ ...f, location_ping_seconds: Number(v) })}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{[[15,"Every 15 seconds"],[30,"Every 30 seconds"],[60,"Every minute"],[120,"Every 2 minutes"],[300,"Every 5 minutes"]].map(([v,l]) => <SelectItem key={v} value={String(v)}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">How often the live map refreshes a team member's position. Longer gaps save phone battery.</p>
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
      <div className="space-y-1.5"><Label>Field staff job-sheet history</Label><Select value={String(f.field_sheet_history_months)} onValueChange={v=>setF({...f,field_sheet_history_months:Number(v)})}><SelectTrigger aria-label="Field staff job-sheet history"><SelectValue/></SelectTrigger><SelectContent>{[[1,'1 month'],[3,'3 months'],[6,'6 months'],[12,'1 year']].map(([v,label])=><SelectItem key={v} value={String(v)}>{label}</SelectItem>)}</SelectContent></Select></div>
      <Button className="h-11" onClick={save}>Save hours & rules</Button>
    </section>
  );
}

type Phones = { office_phone: string; whatsapp_phone: string; emergency_phone: string; company_email: string; website: string; company_address: string; pe_number: string; office_address: OfficeAddress; vat_number: string };

/** Shrinks an image to fit 400×400 and returns a PNG data URL, so it embeds in PDFs and emails. */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 400 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const context = c.getContext("2d");
      if (!context) { reject(new Error("Image processing unavailable")); return; }
      context.drawImage(img, 0, 0, c.width, c.height);
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

function ProfileTab({ companyId, part, navigation }: { companyId: string; part: "details" | "fonts"; navigation?: React.ReactNode }) {
  const { data } = useCompanyRules();
  const { data: profile } = useProfile();
  const planOn = usePlanFeatures();
  const titleAllowed = planOn("custom_app_title");
  const qc = useQueryClient();
  const [p, setP] = useState<Phones | null>(null);
  const [t, setT] = useState<Typography | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState<string | null>(null);
  useEffect(() => { if (data && !p) { setP({...data.phones,pe_number:data.peNumber,office_address:data.officeAddress,vat_number:data.vatNumber}); setT(data.theme); setAppTitle(data.appTitle); } }, [data, p]);
  useEffect(() => { if (profile && name === null) setName(profile.companies?.name ?? ""); }, [profile, name]);
  useEffect(() => { if (t) applyTypography(t); }, [t]);
  if (!p || !t || name === null || appTitle === null) return null;
  const save = async () => {
    const n = name.trim();
    if (part === "details" && !n) { toast.error("Company name can't be empty"); return; }
    if (part === "details" && n !== (profile?.companies?.name ?? "")) {
      const { error: ce } = await supabase.from("companies").update({ name: n.slice(0, 120) }).eq("id", companyId);
      if (ce) { toast.error(ce.message); return; }
    }
    const { data: currentTheme, error: themeReadError } = await supabase.from("company_settings").select("theme").maybeSingle();
    if (themeReadError) { toast.error(themeReadError.message); return; }
    const storedTheme = { ...((currentTheme?.theme ?? {}) as Record<string, unknown>), ...(planOn("branding_fonts") ? { headers: t.headers, fields: t.fields } : {}) };
    const patch = settingsSectionPatch(part, { ...p, company_address: formatOfficeAddress(p.office_address), office_address: p.office_address, theme: storedTheme, ...(titleAllowed ? { app_title: appTitle.trim().slice(0, 40) } : {}) });
    const { error } = await supabase.from("company_settings").upsert({ company_id: companyId, ...patch } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["company-settings"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
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
  const style = (k: "headers" | "fields", l: string) => {
    const v = t[k];
    const up = (patch: Partial<TextStyle>) => setT({ ...t, [k]: { ...v, ...patch } });
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <p className="font-medium text-foreground">{l}</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Select value={v.font} onValueChange={(f) => up({ font: f })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_CHOICES.map((f) => <SelectItem disabled={!planOn("branding_fonts") && f.value !== "default" && f.value !== v.font} key={f.value} value={f.value}><span style={{ fontFamily: f.css || undefined }}>{f.label}</span></SelectItem>)}</SelectContent>
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
  if (part === "fonts") return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div><h2 className="font-medium text-foreground">App fonts</h2><p className="text-sm text-muted-foreground">Changes preview live across the app. Save to apply for everyone in your company.</p></div>
      <BrandingLock allowed={planOn("branding_fonts")} feature="branding_fonts"><div className="grid gap-4 md:grid-cols-2">{style("headers", "Headers & titles")}{style("fields", "Field labels")}</div>
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setT({ ...t, ...DEFAULT_THEME })}>Reset fonts</Button><Button type="button" size="sm" onClick={save}>Save fonts</Button></div></BrandingLock>
    </section>
  );
  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Company name & app title</h2><p className="text-sm text-muted-foreground">The company name appears under the logo in the menu and on client documents.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="company-name">Company name</Label><Input id="company-name" className="h-11" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="app-title">App title</Label>
            <Input id="app-title" className="h-11" maxLength={40} placeholder="FieldBridge" disabled={!titleAllowed} value={titleAllowed ? appTitle : ""} onChange={(e) => setAppTitle(e.target.value)} />
            <p className="text-xs text-muted-foreground">{titleAllowed ? "Shown at the top of the menu. Leave empty to use FieldBridge." : "Locked — available in Plus, Pro & Enterprise."}</p>
          </div>
        </div>
      </section>
      <LogoCard companyId={companyId} current={data?.logo ?? ""} />
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Company contact details</h2><p className="text-sm text-muted-foreground">Shown to clients on job sheets and in "on the way" messages.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {phone("office_phone", "Office phone")}
          {phone("whatsapp_phone", "WhatsApp dispatch number", "Clients see this number on WhatsApp updates.")}
          {phone("emergency_phone", "24/7 emergency line")}
          <div className="space-y-1.5"><Label>Company email</Label><Input className="h-11" type="email" value={p.company_email} onChange={(e) => setP({ ...p, company_email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="company-website">Website</Label><Input id="company-website" className="h-11" type="url" maxLength={200} placeholder="https://www.example.com" value={p.website ?? ""} onChange={(e) => setP({ ...p, website: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="company-pe-number">PE number (Principal Employer)</Label><Input id="company-pe-number" value={p.pe_number} onChange={e=>setP({...p,pe_number:e.target.value})}/></div>
        <div className="space-y-3"><h3 className="font-medium">Office address</h3><div className="grid gap-3 sm:grid-cols-2">{([['building','Building name / number'],['street','Street address'],['city','City / locality'],['postalCode','Postal code']] as const).map(([key,label])=><div key={key} className="space-y-1.5"><Label htmlFor={`office-${key}`}>{label}</Label><Input id={`office-${key}`} className="h-11" maxLength={200} value={p.office_address[key]} onChange={e=>setP({...p,office_address:{...p.office_address,[key]:e.target.value}})} /></div>)}</div><p className="text-sm text-muted-foreground">{formatOfficeAddress(p.office_address)}</p></div><div className="space-y-1.5"><Label htmlFor="company-vat">VAT / Tax number</Label><Input id="company-vat" className="h-11" maxLength={60} value={p.vat_number} onChange={e=>setP({...p,vat_number:e.target.value})}/></div>
      </section>
      <div className="flex flex-wrap items-center gap-2"><Button className="h-11" onClick={save}>Save company details</Button></div>
    </div>
  );
}

function IndustryTab({ companyId }: { companyId: string }) {
  const { data } = useCompanyRules();
  const on = usePlanFeatures();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Appearance["industryPreset"] | null>(null);
  const [trades, setTrades] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data && preset === null) { setPreset(data.appearance.industryPreset); setTrades(expandServices(data.trades)); } }, [data, preset]);
  if (!data || preset === null) return null;
  const save = async () => {
    setBusy(true);
    try {
      const { data: cur, error: re } = await supabase.from("company_settings").select("theme").maybeSingle(); if (re) throw re;
      const theme = (cur?.theme ?? {}) as Record<string, unknown>;
      const appearance = { ...((theme["appearance"] ?? {}) as Record<string, unknown>), ...(on("branding_industry") ? { industryPreset: preset } : {}) };
      const { error } = await supabase.from("company_settings").upsert({ company_id: companyId, industry: INDUSTRY_LABELS[preset], trades, theme: { ...theme, appearance } as never });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["company-settings"] }); toast.success("Industry & services saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Main industry</h2><p className="text-sm text-muted-foreground">Sets the wording of menus and job sheets across the app.</p></div>
        <div role="radiogroup" aria-label="Main industry" className="grid gap-2 sm:grid-cols-2">
          {INDUSTRY_PRESETS.map((k) => (
            <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${preset === k ? "border-primary bg-primary/10" : ""}`}>
              <input type="radio" name="industry" className="h-4 w-4 accent-primary" checked={preset === k} onChange={() => setPreset(k)} />{INDUSTRY_LABELS[k]}
            </label>
          ))}
        </div>
        {!on("branding_industry") && <p className="text-xs text-muted-foreground">Industry-specific menu wording is available on higher plans; your choice is still saved.</p>}
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div><h2 className="font-medium text-foreground">Operating Trades & Services</h2><p className="text-sm text-muted-foreground">Select the trade disciplines your company delivers. Price lists, site surveys and estimates only offer these. Leave all off to show every trade.</p></div>
        <OperatingServices companyId={companyId} values={trades} onChange={setTrades}/>
      </section>
      <Button className="h-11" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save industry & services"}</Button>
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

type SectionItem = { key: string; label: string; render: () => React.ReactNode };
function SettingsSections({ superuser, companyId, userId, role }: { superuser: boolean; companyId: string; userId: string; role: Role }) {
  const libraryName = useCompanyTitle("document library");
  const { data: profile } = useProfile();
  const can = useCan(profile);
  const { section = "profile" } = Route.useSearch();
  const navigate = useNavigate();
  const [active, setActive] = useState(section);
  const [visited, setVisited] = useState([section]);
  const heading = useRef<HTMLHeadingElement>(null);
  const shouldScroll = useRef(false);
  const selectSection = (key: string) => {
    if (key === active) return;
    shouldScroll.current = true;
    setVisited(previous => previous.includes(key) ? previous : [...previous, key]);
    setActive(key);
    void navigate({ to: "/company", search: { section: key }, replace: true });
  };
  useEffect(() => {
    if (!shouldScroll.current) return;
    shouldScroll.current = false;
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [active]);
  const { edition } = useEdition();
  const inHouse = edition === "hotel" || edition === "retail";
  const groups: { title: string; items: SectionItem[] }[] = [
    { title: "General & trade", items: [
      { key: "profile", label: "Profile & details", render: () => <ProfileTab companyId={companyId} part="details" navigation={navigation} /> },
      { key: "industry", label: "Industry & trades", render: () => <IndustryTab companyId={companyId} /> },
      { key: "hours", label: "Hours & overtime", render: () => <HoursTab companyId={companyId} /> },
      { key: "vehicles", label: "Clock-in & vehicles", render: () => <VehicleCompanySettings companyId={companyId} /> },
      { key: "inventory", label: "Inventory control", render: () => <InventoryControlSettings companyId={companyId} /> },
      { key: "dispatch-incentives", label: "Dispatch incentives", render: () => <ClaimIncentiveSettings companyId={companyId} /> },
      ...(edition === "hotel" || edition === "retail" ? [
        { key: "asset-ids", label: "Asset ID format (step 1)", render: () => <IdentifierSettings companyId={companyId} /> },
        { key: "configurator", label: edition === "hotel" ? "Room & floor configurator (step 2)" : "Store & department configurator (step 2)", render: () => <SpaceConfigurator companyId={companyId} edition={edition} /> },
      ] : []),
    ] },
    { title: "Branding & appearance", items: [
      { key: "branding", label: "Branding & PDF styling", render: () => <div className="space-y-6"><AppearanceSettings companyId={companyId} /><ProfileTab companyId={companyId} part="fonts" /><DocumentSettings companyId={companyId} part="branding" /></div> },
    ] },
    { title: inHouse ? "Numbering & exports" : "Commercial & numbering", items: [
      ...(edition === 'contractor' ? [{ key: 'client-billing', label: 'Client billing', render: () => <ClientBillingSettings companyId={companyId} /> }] : []),
      ...(inHouse ? [] : [{ key: "estimates", label: "Estimates & suppliers", render: () => <div className="space-y-4">{superuser&&<Button asChild variant="outline"><Link to="/subscription" hash="custom-requests">Request a custom module / template</Link></Button>}<QuoteAcceptanceSetting companyId={companyId} /><EstimateSettings companyId={companyId} /></div> }]),
      { key: "numbering", label: "Numbering & ID formats", render: () => <div className="space-y-6"><NumberingSettings companyId={companyId} /><IdentifierSettings companyId={companyId}/></div> },
      ...(inHouse ? [{ key: "integrations", label: "Hours & payroll export", render: () => <HoursExportSettings /> }] : [
        { key: "terms", label: "Terms & conditions", render: () => <DocumentSettings companyId={companyId} part="terms" /> },
        { key: "library", label: libraryName, render: () => <div className="space-y-4">{superuser&&<Button asChild variant="outline"><Link to="/subscription" hash="custom-requests">Request a custom module / template</Link></Button>}<DocumentLibrary companyId={companyId} userId={userId} /></div> },
        { key: "pricelist", label: "Price list", render: () => <PriceListSettings companyId={companyId} /> },
      ]),
    ] },
    { title: "Integrations & access", items: [
      ...(inHouse ? [] : [{ key: "crm", label: "CRM settings", render: () => <CrmSettings companyId={companyId} actorRole={superuser ? "superuser" : role} /> }]),
      ...(superuser ? [{ key: "access", label: "Role access", render: () => <AccessTab companyId={companyId} /> }] : []),
      { key: "messaging", label: "Messages & emails", render: () => <IntegrationsSettings part="messaging" companyId={companyId} /> },
      ...(inHouse ? [] : [{ key: "integrations", label: "Accounting", render: () => <IntegrationsSettings part="accounting" companyId={companyId} /> }]),
      { key: "technical", label: "Technical data structure", render: () => <TechnicalStructure companyId={companyId} /> },
      { key: "safety", label: "Safety & faults", render: () => <SafetySettings companyId={companyId} /> },
      ...(can("fields") ? [{ key: "fields", label: "Fields & lookups", render: () => <FieldsEditor /> }] : []),
    ] },
  ];
  const all = groups.flatMap((g) => g.items);
  useEffect(() => {
    const key = all.some(i => i.key === section) ? section : "profile";
    setActive(key);
    setVisited(previous => previous.includes(key) ? previous : [...previous, key]);
  }, [section]);
  const activeIndex = Math.max(0, all.findIndex((i) => i.key === active));
  const current = all[activeIndex];
  if (!current) return null;
  const navigation = <>
    <Button type="button" variant="outline" className="h-11" disabled={activeIndex <= 0} onClick={() => { const previous = all[activeIndex - 1]; if (previous) selectSection(previous.key); }}><ArrowLeft className="mr-2 h-4 w-4" />Previous</Button>
    <Button type="button" variant="outline" className="h-11" disabled={activeIndex === all.length - 1} onClick={() => { const next = all[activeIndex + 1]; if (next) selectSection(next.key); }}>Next<ArrowRight className="ml-2 h-4 w-4" /></Button>
  </>;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Tabs value={groups.find(g => g.items.some(i => i.key === active))?.title ?? 'General & trade'} onValueChange={value => { const next = groups.find(g => g.title === value)?.items[0]; if (next) selectSection(next.key); }}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-4">{groups.map(g => <TabsTrigger key={g.title} value={g.title} className="min-w-0 whitespace-normal py-3">{g.title}</TabsTrigger>)}</TabsList>
      </Tabs>
      <nav aria-label="Company settings sections" className="flex flex-wrap gap-2 border-b pb-4">
        {groups.find(g => g.items.some(i => i.key === active))?.items.map(i => <Button key={i.key} variant={i.key === active ? 'secondary' : 'ghost'} size="sm" aria-current={i.key === active ? 'page' : undefined} onClick={() => selectSection(i.key)} className="h-auto max-w-full whitespace-normal text-left">{i.label}</Button>)}
      </nav>
      <section className="min-w-0">
        <h2 ref={heading} tabIndex={-1} className="mb-4 scroll-mt-24 text-lg font-semibold text-foreground outline-none">{current.label}</h2>
        {all.filter(item => visited.includes(item.key)).map(item => <div key={item.key} hidden={item.key !== current.key}>{item.render()}</div>)}
        {<nav aria-label="Previous and next settings section" className={`mt-6 flex flex-wrap justify-between gap-2 border-t pt-4 ${current.key === "branding" ? "pb-16 lg:pb-0" : ""}`}>{navigation}</nav>}
      </section>
    </div>
  );
}
