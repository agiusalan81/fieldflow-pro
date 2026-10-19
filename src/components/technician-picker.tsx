import { useState } from "react";
import { X } from "lucide-react";
import { SearchSelect } from "@/components/search-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { initialsOf } from "@/lib/profile";
import { technicianCount } from "@/lib/jobsheets";

export function TechnicianPicker({ count, selected, users, disabled, onChange }: {
  count: number; selected: string[]; users: { id: string; full_name: string; technician_initials?: string | null }[];
  disabled: boolean; onChange: (count: number, initials: string[]) => void;
}) {
  const [manual, setManual] = useState("");
  // Local text so the field can be cleared and retyped freely; committed only when it holds a valid number.
  const [text, setText] = useState(String(count));
  const [synced, setSynced] = useState(count);
  if (count !== synced) { setSynced(count); setText(String(count)); }
  const typeCount = (raw: string) => {
    setText(raw);
    if (raw.trim() === "") return;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) return;
    onChange(Math.max(n, new Set(selected.filter(Boolean)).size), selected);
  };
  const add = (values: string[]) => {
    const next = [...new Set([...selected, ...values.map((v) => v.trim().toUpperCase()).filter(Boolean)])];
    onChange(technicianCount(count, next), next);
  };
  return <div className="mt-3 space-y-2">
    <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
      <div className="space-y-1"><Label>No. of technicians</Label><Input aria-label="No. of technicians" type="number" min={0} step={1} inputMode="numeric" disabled={disabled} value={text} onChange={(e) => typeCount(e.target.value)} onBlur={() => setText(String(count))} /></div>
      <div className="space-y-1"><Label>Technicians</Label><SearchSelect value={null} disabled={disabled} placeholder="Search name or type initials…" freeText={manual} onFreeText={setManual} onAddFreeText={(text) => { add(text.split(/[,;\s]+/)); setManual(""); }} options={users.filter((u) => !selected.includes(initialsOf(u))).map((u) => ({ value: u.id, label: u.full_name, hint: initialsOf(u) }))} onChange={(id) => { const u = users.find((u) => u.id === id); if (u) add([initialsOf(u)]); }} /></div>
    </div>
    <div className="flex flex-wrap gap-2">{selected.map((initials) => <Button key={initials} type="button" size="sm" variant="secondary" disabled={disabled} aria-label={`Remove technician ${initials}`} onClick={() => { const next = selected.filter((s) => s !== initials); onChange(Math.max(1, count - 1, next.length), next); }}>{initials}<X className="ml-1 h-3 w-3" /></Button>)}</div>
  </div>;
}
