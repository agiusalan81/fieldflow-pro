import { useState } from "react";
import { X } from "lucide-react";
import { SearchSelect } from "@/components/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialsOf } from "@/lib/profile";
import { technicianCount } from "@/lib/jobsheets";

export function TechnicianPicker({ count, selected, users, disabled, onChange }: {
  count: number; selected: string[]; users: { id: string; full_name: string; technician_initials?: string | null }[];
  disabled: boolean; onChange: (count: number, initials: string[]) => void;
}) {
  const [manual, setManual] = useState("");
  const add = (values: string[]) => {
    const next = [...new Set([...selected, ...values.map((v) => v.trim().toUpperCase()).filter(Boolean)])];
    onChange(technicianCount(count, next), next);
  };
  return <div className="mt-3 space-y-2">
    <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
      <div className="space-y-1"><Label>No. of technicians</Label><Input aria-label="No. of technicians" type="number" min={Math.max(1, selected.length)} step={1} inputMode="numeric" disabled={disabled} value={count} onChange={(e) => onChange(technicianCount(Number(e.target.value), selected), selected)} /></div>
      <div className="space-y-1"><Label>Technicians</Label><SearchSelect value={null} disabled={disabled} placeholder="Search name or initials…" options={users.filter((u) => !selected.includes(initialsOf(u))).map((u) => ({ value: u.id, label: u.full_name, hint: initialsOf(u) }))} onChange={(id) => { const u = users.find((u) => u.id === id); if (u) add([initialsOf(u)]); }} /></div>
    </div>
    <div className="flex flex-wrap gap-2">{selected.map((initials) => <Button key={initials} type="button" size="sm" variant="secondary" disabled={disabled} aria-label={`Remove technician ${initials}`} onClick={() => { const next = selected.filter((s) => s !== initials); onChange(Math.max(1, count - 1, next.length), next); }}>{initials}<X className="ml-1 h-3 w-3" /></Button>)}</div>
    {!disabled && <div className="flex gap-2"><Input aria-label="Manual technician initials" placeholder="Enter initials" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(manual.split(/[,;\s]+/)); setManual(""); } }} /><Button type="button" variant="outline" disabled={!manual.trim()} onClick={() => { add(manual.split(/[,;\s]+/)); setManual(""); }}>Add initials</Button></div>}
  </div>;
}