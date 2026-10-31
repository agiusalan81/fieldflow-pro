import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ComboGroup = { group: string; items: string[] };

/** Searchable picker that also accepts a typed custom value. */
export function CreatableCombobox({ value, onChange, groups, placeholder = "Choose or type…", ariaLabel, className }: {
  value: string; onChange: (v: string) => void; groups: ComboGroup[]; placeholder?: string; ariaLabel?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const all = groups.flatMap((g) => g.items);
  const typed = q.trim();
  const isNew = typed && !all.some((i) => i.toLowerCase() === typed.toLowerCase());
  const pick = (v: string) => { onChange(v); setQ(""); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label={ariaLabel} aria-expanded={open} className={cn("h-11 w-full justify-between font-normal", className)}>
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or add…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            {isNew && <CommandGroup><CommandItem value={`__add ${typed}`} onSelect={() => pick(typed)}><Plus className="mr-2 h-4 w-4" />Add “{typed}”</CommandItem></CommandGroup>}
            {groups.map((g) => ({...g,items:g.items.filter(i=>i.toLowerCase().includes(typed.toLowerCase()))})).map((g) => g.items.length > 0 && (
              <CommandGroup key={g.group} heading={g.group}>
                {g.items.map((i) => (
                  <CommandItem key={g.group + i} value={i} onSelect={() => pick(i)}>
                    <Check className={cn("mr-2 h-4 w-4", value === i ? "opacity-100" : "opacity-0")} />{i}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
