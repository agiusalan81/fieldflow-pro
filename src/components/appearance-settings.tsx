import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCompanyRules } from "@/lib/company";
import { supabase } from "@/integrations/supabase/client";
import { usePlanFeatures } from "@/lib/plan-features";
import { appearanceVariables, contrastRatio, ICON_PRESETS, INDUSTRY_LABELS, type Appearance } from "@/lib/branding";
import { resolveAppearanceAssets, brandDownload } from "@/lib/branding-assets";
import { BrandingLock } from "./branding-lock";
import { BrandingUpload } from "./branding-upload";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ClipboardList, CalendarDays, Users } from "lucide-react";

export function AppearanceSettings({ companyId }: { companyId: string }) {
  const { data } = useCompanyRules(); const on = usePlanFeatures(); const qc = useQueryClient();
  const [draft, setDraft] = useState<Appearance | null>(null); const [preview, setPreview] = useState<Appearance | null>(null);
  const [fontPath, setFontPath] = useState<string | null>(null); const [fontName, setFontName] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data && !draft) { setDraft(data.appearance); setFontPath(data.theme.customFontPath ?? ""); setFontName(data.theme.customFontName ?? ""); } }, [data, draft]);
  useEffect(() => { if (!draft) return; let active = true; void resolveAppearanceAssets(supabase, draft).then(a => { if (active) setPreview(a); }).catch(() => toast.error("Could not load background preview")); return () => { active = false; }; }, [draft]);
  if (!draft || !data || fontPath === null) return null;
  const change = (patch: Partial<Appearance>) => setDraft({ ...draft, ...patch });
  const save = async () => {
    if (draft.fieldBackground && draft.fieldText && contrastRatio(draft.fieldBackground, draft.fieldText) < 4.5) { toast.error("Choose field colours with stronger contrast"); return; }
    setBusy(true);
    try {
      const { data: current, error: readError } = await supabase.from("company_settings").select("theme").maybeSingle(); if (readError) throw readError;
      const theme = (current?.theme ?? {}) as Record<string, unknown>;
      const prior = (theme["appearance"] ?? {}) as Record<string, unknown>;
      const appearance = { ...prior, ...(on("branding_advanced") ? { backgroundPath: draft.backgroundPath, menuBackgroundPath: draft.menuBackgroundPath, fieldBackground: draft.fieldBackground, fieldText: draft.fieldText, iconPreset: draft.iconPreset } : {}) };
      const next = { ...theme, appearance, ...(on("branding_custom_fonts") ? { customFontPath: fontPath, customFontName: fontName } : {}) };
      const { error } = await supabase.from("company_settings").upsert({ company_id: companyId, theme: next as never }); if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["company-settings"] }); toast.success("Company appearance saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save appearance"); } finally { setBusy(false); }
  };
  return <section className="space-y-6 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Company appearance</h2><div className="grid gap-6 lg:grid-cols-2"><div className="space-y-5">
    <BrandingLock allowed={on("branding_advanced")} feature="branding_advanced">
      <BrandingUpload companyId={companyId} kind="backgrounds" label="App background" path={draft.backgroundPath} onChange={path => change({ backgroundPath: path })} />
      <BrandingUpload companyId={companyId} kind="backgrounds" label="Menu background" path={draft.menuBackgroundPath} onChange={path => change({ menuBackgroundPath: path })} />
      <div className="grid grid-cols-2 gap-3">{([['fieldBackground', 'Field background'], ['fieldText', 'Field text']] as const).map(([key, label]) => <div key={key} className="space-y-2"><Label>{label}</Label><div className="flex gap-2"><Input aria-label={label} type="color" className="h-10 w-14 p-1" value={draft[key] || (key === "fieldBackground" ? "#ffffff" : "#202020")} onChange={e => change({ [key]: e.target.value })} /><Button variant="ghost" size="sm" onClick={() => change({ [key]: "" })}>Default</Button></div></div>)}</div>
      <div className="space-y-2"><Label>Menu icon set</Label><Select value={draft.iconPreset} onValueChange={v => change({ iconPreset: v as Appearance["iconPreset"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ICON_PRESETS.map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent></Select></div>
    </BrandingLock>
    <BrandingLock allowed={on("branding_custom_fonts")} feature="branding_custom_fonts"><BrandingUpload companyId={companyId} kind="fonts" label="Company app font" path={fontPath} onChange={async (path, name) => { if (path) { try { const source = await brandDownload(supabase, path); const face = new FontFace("FieldBridgeCompany", `url("${source}")`); await face.load(); } catch { toast.error("This font cannot be used in the app"); return; } } setFontPath(path); setFontName(name); }} />{fontName && <p className="break-words text-sm">{fontName}</p>}</BrandingLock>
  </div><div className="space-y-2"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">Live preview — company appearance</p><span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Sample preview</span></div><div style={appearanceVariables(preview ?? draft)} data-icons={draft.iconPreset} className="tenant-experience appearance-preview grid min-h-80 grid-cols-[120px_minmax(0,1fr)] overflow-hidden border"><div className="tenant-menu space-y-5 border-r p-3"><p className="break-words font-semibold">{data.appTitle || "FieldBridge"}</p><ClipboardList className="h-5 w-5" /><CalendarDays className="h-5 w-5" /><Users className="h-5 w-5" /></div><div className="tenant-workspace space-y-4 p-4"><p className="font-semibold">{INDUSTRY_LABELS[draft.industryPreset]}</p><Label>Work carried out</Label><Input readOnly value="Service completed" /><div className="border bg-card p-3 text-sm">Your company · Service sheet</div></div></div></div></div><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save company appearance"}</Button></section>;
}