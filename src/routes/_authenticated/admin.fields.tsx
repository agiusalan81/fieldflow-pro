import { ContactRolesAdmin } from "@/components/contact-roles-admin";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { AppShell, EmptyState } from "@/components/app-shell";
import { lookupCategory, type FieldDef } from "@/components/custom-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/fields")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Fields & lookups — FieldOps" },
      { name: "description", content: "Build custom fields and curate dropdown options for your company." },
      { property: "og:title", content: "Fields & lookups — FieldOps" },
      { property: "og:description", content: "Custom field and lookup builder." },
    ],
  }),
  component: FieldsPage,
});

const TARGETS = { job_sheet: "Job sheet", asset: "Asset", client: "Client" } as const;
const TYPES = { text: "Text", number: "Number", dropdown: "Dropdown", date: "Date", checkbox: "Checkbox" } as const;

function FieldsPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [f, setF] = useState({ target_entity: "job_sheet", field_label: "", field_type: "text", options: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const [newOpt, setNewOpt] = useState("");

  const { data: defs = [] } = useQuery({
    queryKey: ["all-field-defs"],
    queryFn: async () => (await supabase.from("custom_field_definitions").select("*").order("field_label")).data as FieldDef[] ?? [],
  });
  const { data: lookups = [] } = useQuery({
    queryKey: ["all-lookups"],
    queryFn: async () => (await supabase.from("lookup_options").select("*").order("usage_count", { ascending: false })).data ?? [],
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["all-field-defs"] });
    qc.invalidateQueries({ queryKey: ["all-lookups"] });
    qc.invalidateQueries({ queryKey: ["field-defs"] });
    qc.invalidateQueries({ queryKey: ["lookups"] });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const options = f.field_type === "dropdown" ? f.options.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const { error } = await supabase.from("custom_field_definitions").insert({
      company_id: profile!.company_id, target_entity: f.target_entity as never, field_label: f.field_label, field_type: f.field_type as never, options_list: options,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Field added");
    setF({ ...f, field_label: "", options: "" });
    refresh();
  };
  const removeDef = async (id: string) => {
    if (!confirm("Delete this field? Saved values stay on records but won't show.")) return;
    const { error } = await supabase.from("custom_field_definitions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (selected === id) setSelected(null);
    refresh();
  };

  const sel = defs.find((d) => d.id === selected);
  const selLookups = sel ? lookups.filter((l) => l.category === lookupCategory(sel.id)) : [];
  const baseOpts = sel && Array.isArray(sel.options_list) ? (sel.options_list as string[]) : [];

  const addLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sel || !newOpt.trim()) return;
    const { error } = await supabase.from("lookup_options").insert({
      category: lookupCategory(sel.id), label_value: newOpt.trim(), company_id: profile!.company_id, created_by_user_id: profile!.id, is_global: false,
    });
    if (error) { toast.error(error.message); return; }
    setNewOpt(""); refresh();
  };
  const removeLookup = async (id: string) => {
    const { error } = await supabase.from("lookup_options").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const removeBase = async (opt: string) => {
    const { error } = await supabase.from("custom_field_definitions").update({ options_list: baseOpts.filter((o) => o !== opt) }).eq("id", sel!.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const promote = async (l: { id: string; label_value: string }) => {
    const { error } = await supabase.from("custom_field_definitions").update({ options_list: [...baseOpts, l.label_value] }).eq("id", sel!.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("lookup_options").delete().eq("id", l.id);
    refresh();
  };

  return (
    <AppShell title="Fields & lookups">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <form onSubmit={create} className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-medium text-foreground">Add a custom field</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Shows on</Label>
                <Select value={f.target_entity} onValueChange={(v) => setF({ ...f, target_entity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TARGETS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={f.field_type} onValueChange={(v) => setF({ ...f, field_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Label</Label><Input required value={f.field_label} onChange={(e) => setF({ ...f, field_label: e.target.value })} placeholder="e.g. Fault code" /></div>
            {f.field_type === "dropdown" && (
              <div className="space-y-1.5"><Label>Starting options (comma separated)</Label><Input value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} placeholder="Leak, Noise, No power" /></div>
            )}
            <Button type="submit" className="w-full"><Plus className="mr-1 h-4 w-4" />Add field</Button>
          </form>

          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3 font-medium text-foreground">Fields</h2>
            {defs.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No fields yet.</p> : (
              <ul className="divide-y">
                {defs.map((d) => (
                  <li key={d.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-5 py-3 ${selected === d.id ? "bg-accent" : ""}`}>
                    <button className="min-w-0 text-left" onClick={() => setSelected(d.id)} disabled={d.field_type !== "dropdown"}>
                      <p className="truncate text-sm font-medium text-foreground">{d.field_label}</p>
                      <p className="text-xs text-muted-foreground">{TARGETS[d.target_entity as keyof typeof TARGETS]} · {TYPES[d.field_type]}{d.field_type === "dropdown" && " · tap to manage options"}</p>
                    </button>
                    <Button size="icon" variant="ghost" aria-label="Delete field" onClick={() => removeDef(d.id)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-medium text-foreground">Dropdown options</h2>
          {!sel ? (
            <div className="mt-4"><EmptyState>Pick a dropdown field to curate its options.</EmptyState></div>
          ) : (
            <div className="mt-4 space-y-5">
              <p className="text-sm text-muted-foreground">Options for <strong className="text-foreground">{sel.field_label}</strong>. Technicians can add new ones while filling in a job — they appear under “Added by your team”.</p>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Standard options</p>
                <div className="flex flex-wrap gap-2">
                  {baseOpts.map((o) => (
                    <span key={o} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">{o}<button aria-label={`Remove ${o}`} onClick={() => removeBase(o)}><X className="h-3 w-3" /></button></span>
                  ))}
                  {baseOpts.length === 0 && <span className="text-sm text-muted-foreground">None</span>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Added by your team (local)</p>
                <ul className="space-y-1.5">
                  {selLookups.filter((l) => !l.is_global).map((l) => (
                    <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="truncate">{l.label_value} <span className="text-xs text-muted-foreground">· used {l.usage_count}×</span></span>
                      <span className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => promote(l)}>Make standard</Button>
                        <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => removeLookup(l.id)}><Trash2 className="h-4 w-4" /></Button>
                      </span>
                    </li>
                  ))}
                  {selLookups.filter((l) => !l.is_global).length === 0 && <li className="text-sm text-muted-foreground">None yet</li>}
                </ul>
                <form onSubmit={addLocal} className="mt-3 flex gap-2">
                  <Input value={newOpt} onChange={(e) => setNewOpt(e.target.value)} placeholder="Add an option" />
                  <Button type="submit">Add</Button>
                </form>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Global (shared across all companies)</p>
                <div className="flex flex-wrap gap-2">
                  {selLookups.filter((l) => l.is_global).map((l) => <span key={l.id} className="rounded-full border px-3 py-1 text-sm">{l.label_value}</span>)}
                  {selLookups.filter((l) => l.is_global).length === 0 && <span className="text-sm text-muted-foreground">None — global options are read-only</span>}
                </div>
              </div>
            </div>
          )}
        </section>
        <ContactRolesAdmin />
        <ContactRolesAdmin category="equipment_type" />
        <ContactRolesAdmin category="contract_category" />
      </div>
    </AppShell>
  );
}
