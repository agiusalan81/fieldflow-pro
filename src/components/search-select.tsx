import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SearchOption = { value: string; label: string; hint?: string | undefined };

/** Type-to-filter dropdown: start typing to see matching suggestions. Optional free-text entry via onAddFreeText. */
export function SearchSelect({ value, options, onChange, placeholder = "Choose…", disabled, freeText, onFreeText, onAddFreeText, onCreate, createLabel = "Add new" }: {
  value: string | null | undefined; options: SearchOption[]; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
  freeText?: string; onFreeText?: (v: string) => void; onAddFreeText?: (text: string) => void;
  /** Adds a "+ Add new…" row; receives the typed search text. */
  onCreate?: (typed: string) => void; createLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const typed = (freeText ?? "").trim();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled} className="h-11 w-full justify-between font-normal">
          <span className={cn("truncate", !current && "text-muted-foreground")}>{current?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" {...(freeText !== undefined ? { value: freeText } : {})} {...(onFreeText ? { onValueChange: onFreeText } : { value: query, onValueChange: setQuery })}
            onKeyDown={(e) => { if (e.key === "Enter" && typed && onAddFreeText) { e.preventDefault(); onAddFreeText(typed); setOpen(false); } }} />
          <CommandList>
            <CommandEmpty>{onAddFreeText ? "No matches — press Enter to add as initials." : onCreate ? <button type="button" className="w-full px-2 text-left text-sm font-medium" onClick={() => { onCreate(query.trim()); setOpen(false); }}>+ {createLabel}{query.trim() ? ` “${query.trim()}”` : ""}</button> : "No matches."}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ""}`} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", o.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
              {onCreate && <CommandItem value={`__create ${query}`} onSelect={() => { onCreate(query.trim()); setOpen(false); }}><span className="truncate font-medium">+ {createLabel}{query.trim() ? ` “${query.trim()}”` : ""}</span></CommandItem>}
              {onAddFreeText && typed && (
                <CommandItem value={`add-${typed}`} onSelect={() => { onAddFreeText(typed); setOpen(false); }}>
                  <span className="truncate">+ Add “{typed.toUpperCase()}” as initials</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
