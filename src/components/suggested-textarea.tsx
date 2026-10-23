import { useId } from "react";
import { SearchSelect } from "@/components/search-select";
import { Textarea } from "@/components/ui/textarea";

export function SuggestedTextarea({ value, onValueChange, suggestions = [], ...props }: Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> & { value: string; onValueChange: (value: string) => void; suggestions?: string[] | undefined }) {
  const id = useId();
  const matching = suggestions.filter(text => text !== value && (!value.trim() || text.toLowerCase().includes(value.trim().toLowerCase())));
  return <div className="space-y-1.5">
    <Textarea {...props} value={value} onChange={event => onValueChange(event.target.value)} />
    {!props.disabled && matching.length > 0 && <SearchSelect value="" placeholder="Previous entries…" options={matching.map((text, index) => ({ value: `${id}-${index}`, label: text }))} onChange={key => {
      const index = matching.findIndex((_text, i) => `${id}-${i}` === key);
      const text = matching[index];
      if (text) onValueChange(text);
    }} />}
  </div>;
}