import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type FieldDef = {
  id: string;
  field_label: string;
  field_type: "text" | "number" | "dropdown" | "date" | "checkbox";
  options_list: unknown;
  target_entity: string;
};

export const lookupCategory = (fieldId: string) => `field:${fieldId}`;

export function useFieldDefs(target: "job_sheet" | "asset" | "client") {
  return useQuery({
    queryKey: ["field-defs", target],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_field_definitions")
        .select("id, field_label, field_type, options_list, target_entity")
        .eq("target_entity", target)
        .order("field_label");
      if (error) throw error;
      return data as FieldDef[];
    },
  });
}

function CreatableSelect({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const cat = lookupCategory(def.id);
  const { data: lookups = [] } = useQuery({
    queryKey: ["lookups", cat],
    queryFn: async () => {
      const { data, error } = await supabase.from("lookup_options").select("id, label_value").eq("category", cat).order("usage_count", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const base = Array.isArray(def.options_list) ? (def.options_list as string[]) : [];
  const options = Array.from(new Set([...base, ...lookups.map((l) => l.label_value)]));
  const typed = search.trim();
  const canAdd = typed && !options.some((o) => o.toLowerCase() === typed.toLowerCase());

  const add = async () => {
    if (!profile) return;
    const { error } = await supabase.from("lookup_options").insert({
      category: cat, label_value: typed, company_id: profile.company_id, created_by_user_id: profile.id, is_global: false, usage_count: 1,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["lookups", cat] });
    onChange(typed);
    setSearch("");
    setOpen(false);
    toast.success(`Added “${typed}”`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-11 w-full justify-between font-normal">
          <span className="truncate">{value || "Select or type to add…"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or type a new option" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{canAdd ? null : "No options"}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => { onChange(o); setOpen(false); }}>
                  <Check className={`mr-2 h-4 w-4 ${value === o ? "opacity-100" : "opacity-0"}`} /> {o}
                </CommandItem>
              ))}
              {canAdd && (
                <CommandItem value={`__add__${typed}`} onSelect={add}>
                  <Plus className="mr-2 h-4 w-4" /> Add “{typed}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CustomFieldsForm({
  defs, values, onChange, disabled,
}: { defs: FieldDef[]; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; disabled?: boolean }) {
  if (!defs.length) return <p className="text-sm text-muted-foreground">No custom fields set up yet.</p>;
  const set = (id: string, v: unknown) => onChange({ ...values, [id]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {defs.map((d) => (
        <div key={d.id} className="space-y-1.5">
          {d.field_type === "checkbox" ? (
            <label className="flex h-11 items-center gap-3 rounded-md border px-3">
              <Checkbox disabled={disabled} checked={!!values[d.id]} onCheckedChange={(c) => set(d.id, !!c)} />
              <span className="text-sm">{d.field_label}</span>
            </label>
          ) : (
            <>
              <Label>{d.field_label}</Label>
              {d.field_type === "dropdown" ? (
                <CreatableSelect def={d} value={(values[d.id] as string) ?? ""} onChange={(v) => set(d.id, v)} />
              ) : (
                <Input
                  className="h-11"
                  disabled={disabled}
                  type={d.field_type === "number" ? "number" : d.field_type === "date" ? "date" : "text"}
                  value={(values[d.id] as string) ?? ""}
                  onChange={(e) => set(d.id, e.target.value)}
                />
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function renderCustomValues(defs: FieldDef[], values: unknown) {
  const v = (values ?? {}) as Record<string, unknown>;
  return defs
    .filter((d) => v[d.id] !== undefined && v[d.id] !== "")
    .map((d) => `${d.field_label}: ${typeof v[d.id] === "boolean" ? (v[d.id] ? "Yes" : "No") : String(v[d.id])}`);
}
