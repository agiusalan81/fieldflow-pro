import { Plus } from "lucide-react";
import { addChoice } from "@/lib/field-documents";

/** One-tap suggestions that append to a comma-separated choice list. Already-added items are hidden. */
export function SuggestionChips({ value, suggestions, onChange }: { value: string; suggestions: string[]; onChange: (next: string) => void }) {
  const have = new Set(value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
  const left = suggestions.filter((s) => !have.has(s.toLowerCase()));
  if (!left.length) return null;
  return <div className="flex flex-wrap gap-1">{left.map((s) => <button key={s} type="button" onClick={() => onChange(addChoice(value, s))} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"><Plus className="mr-0.5 h-3 w-3" />{s}</button>)}</div>;
}
