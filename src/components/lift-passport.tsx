import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { PassportEvidence } from '@/components/passport-evidence';
import {
  DRIVE_TYPES,
  NA,
  equipmentTypeForCategory,
  fieldOptions,
  fieldsFor,
  learnFromPassports,
  normalizeBlocks,
  assetPassportBlocks,
  type PassportAsset,
  sectionsFor,
  type DriveType,
  type PassportBlocks,
  type PassportEquipmentType,
  type PassportField,
} from "@/lib/lift-passport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

/** Creatable auto-suggesting combobox: built-in + learned options, custom entry and N/A. */
function SuggestField({ field, value, options, disabled, onChange }: { field: PassportField; value: string; options: string[]; disabled: boolean; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const typed = query.trim().slice(0, 80);
  const choices = field.type === "select" || options.length ? [NA, ...options] : [NA];
  const filtered = choices.filter((o) => o.toLowerCase().includes(query.toLowerCase()));
  const choose = (v: string) => { onChange(v); setOpen(false); setQuery(""); };
  if (field.type === "number") {
    return (
      <div className="flex gap-1">
        <Input type="number" inputMode="decimal" value={value === NA ? "" : value} disabled={disabled || value === NA} placeholder={value === NA ? NA : "—"} onChange={(e) => onChange(e.target.value)} className="h-10" />
        {!disabled && <Button type="button" variant={value === NA ? "secondary" : "outline"} size="sm" className="h-10 shrink-0" onClick={() => onChange(value === NA ? "" : NA)}>N/A</Button>}
        {field.unit && <span className="self-center text-xs text-muted-foreground">{field.unit}</span>}
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label={field.label} aria-expanded={open} disabled={disabled} className="h-10 w-full min-w-0 justify-between px-2 font-normal">
          <span className="truncate">{value || "Select or type…"}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or add…" value={query} onValueChange={setQuery} onKeyDown={(e) => { if (e.key === "Enter" && typed) { e.preventDefault(); choose(typed); } }} />
          <CommandList>
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => choose(o)}>
                  <Check className={`mr-2 h-4 w-4 ${value === o ? "opacity-100" : "opacity-0"}`} />{o}
                </CommandItem>
              ))}
              {typed && !choices.some((o) => o.toLowerCase() === typed.toLowerCase()) && (
                <CommandItem value={`custom:${typed}`} onSelect={() => choose(typed)}>
                  <Plus className="mr-2 h-4 w-4" />Use “{typed}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function LiftPassport({ assetId, assetCategory, canManage, asset, focus }: { assetId: string; assetCategory: string | null; canManage: boolean; asset?: PassportAsset; focus?: string | undefined }) {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("general");
  const [equipmentType, setEquipmentType] = useState<PassportEquipmentType>(equipmentTypeForCategory(assetCategory));
  const [driveType, setDriveType] = useState<DriveType>("");
  const [blocks, setBlocks] = useState<PassportBlocks>({});
  const [notes, setNotes] = useState("");

  const q = useQuery({
    queryKey: ["lift-passport", assetId],
    queryFn: async () => {
      const r = await supabase.from("lift_passports").select("*").eq("asset_id", assetId).maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });

  // Learn suggestions from the company's other passports.
  const history = useQuery({
    queryKey: ["lift-passport-history", profile?.company_id],
    enabled: editing && !!profile,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await supabase.from("lift_passports").select("general, machine_drive, suspension_safety, controller_electronics, doors_cabin, escalator_geometry, escalator_steps_chains, escalator_handrail_balustrade").limit(200);
      if (r.error) throw r.error;
      return learnFromPassports(r.data ?? []);
    },
  });

  const startEdit = () => {
    const row = q.data;
    setEquipmentType((row?.equipment_type as PassportEquipmentType | undefined) ?? equipmentTypeForCategory(assetCategory));
    setDriveType((row?.drive_type as DriveType | undefined) ?? "");
    setBlocks(assetPassportBlocks(asset, assetCategory, row));
    setNotes(row?.notes ?? "");
    setTab("general");
    setEditing(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        asset_id: assetId,
        equipment_type: equipmentType,
        drive_type: equipmentType === "lift" ? driveType : "",
        general: blocks['general'] ?? {},
        machine_drive: blocks['machine_drive'] ?? {},
        suspension_safety: blocks['suspension_safety'] ?? {},
        controller_electronics: blocks['controller_electronics'] ?? {},
        doors_cabin: blocks['doors_cabin'] ?? {},
        escalator_geometry: blocks['escalator_geometry'] ?? {},
        escalator_steps_chains: blocks['escalator_steps_chains'] ?? {},
        escalator_handrail_balustrade: blocks['escalator_handrail_balustrade'] ?? {},
        notes,
        updated_at: new Date().toISOString(),
      };
      const r = q.data
        ? await supabase.from("lift_passports").update(payload).eq("id", q.data.id)
        : await supabase.from("lift_passports").insert(payload);
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      toast.success("Technical passport saved");
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ["lift-passport", assetId] });
      await qc.invalidateQueries({ queryKey: ["lift-passport-history"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save passport"),
  });

  const sections = useMemo(() => sectionsFor(equipmentType), [equipmentType]);
  const activeSection = sections.find((s) => s.key === tab) ?? sections[0];
  const setValue = (section: string, key: string, v: string) =>
    setBlocks((b) => ({ ...b, [section]: { ...(b[section] ?? {}), [key]: v } }));

  const row = q.data;
  const viewBlocks = useMemo(() => (editing ? blocks : normalizeBlocks(row)), [editing, blocks, row]);
  const viewType = (editing ? equipmentType : (row?.equipment_type as PassportEquipmentType | undefined)) ?? equipmentTypeForCategory(assetCategory);
  const viewDrive = (editing ? driveType : (row?.drive_type as DriveType | undefined)) ?? "";
  const viewSections = sectionsFor(viewType);
  const viewActive = viewSections.find((s) => s.key === tab) ?? viewSections[0];
  if (!activeSection || !viewActive) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Technical passport</h2>
          <p className="text-xs text-muted-foreground">Tenant-only engineering record — never shown in the client portal.</p>
        </div>
        {canManage && !editing && (
          <Button type="button" variant={row ? "outline" : "default"} size="sm" onClick={startEdit}>
            {row ? "Edit passport" : "Create passport"}
          </Button>
        )}
      </div>

      {!row && !editing ? (
        <p className="text-sm text-muted-foreground">No technical passport yet for this equipment.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {editing && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Equipment</Label>
                <div className="flex gap-1">
                  {(["lift", "escalator", "moving_walk"] as const).map((t) => (
                    <Button key={t} type="button" size="sm" variant={equipmentType === t ? "default" : "outline"} onClick={() => { setEquipmentType(t); setTab("general"); }}>
                      {t === "moving_walk" ? "Moving walk" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {editing && equipmentType === "lift" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Drive</Label>
                <div className="flex gap-1">
                  {DRIVE_TYPES.map((d) => (
                    <Button key={d.value} type="button" size="sm" variant={driveType === d.value ? "default" : "outline"} onClick={() => setDriveType(d.value)}>
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1 border-b pb-2">
            {(editing ? sections : viewSections).map((s) => (
              <Button key={s.key} type="button" size="sm" variant={(editing ? activeSection : viewActive).key === s.key ? "default" : "ghost"} onClick={() => setTab(s.key)}>
                {s.title}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fieldsFor(editing ? activeSection : viewActive, viewDrive).map((f) => {
              const sectionKey = (editing ? activeSection : viewActive).key;
              const value = viewBlocks[sectionKey]?.[f.key] ?? "";
              return (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}{f.unit ? ` (${f.unit})` : ""}</Label>
                  {editing ? (
                    <SuggestField field={f} value={value} options={fieldOptions(f, history.data ?? {})} disabled={!canManage} onChange={(v) => setValue(sectionKey, f.key, v)} />
                  ) : (
                    <p className="min-h-6 text-sm">{value || "—"}</p>
                  )}
                </div>
              );
            })}
          </div>

          {editing ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Internal notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Tenant-only notes…" />
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save passport"}</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            row?.notes && <p className="text-sm text-muted-foreground">{row.notes}</p>
          )}
        </>
      )}
      <PassportEvidence assetId={assetId} canManage={canManage} equipmentType={viewType} driveType={viewDrive} focus={focus}/>
    </section>
  );
}
