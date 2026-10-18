import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Numeric input that behaves like a calculator field: focusing selects the
 * current value and typing replaces a plain zero instead of appending to it.
 */
export function NumInput({ value, onChange, ...props }: {
  value: number;
  onChange: (v: number) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      type="number"
      inputMode="decimal"
      {...props}
      value={draft ?? (Number.isFinite(value) ? String(value) : "")}
      onFocus={(e) => { e.target.select(); props.onFocus?.(e); }}
      onBlur={(e) => { setDraft(null); props.onBlur?.(e); }}
      onChange={(e) => {
        const raw = e.target.value;
        // Typing over a selected zero (or starting from 0) replaces it.
        const next = raw.length > 1 && raw.startsWith("0") && !raw.startsWith("0.") && (draft === null || draft === "0") ? raw.replace(/^0+/, "") : raw;
        setDraft(next);
        const n = Number(next);
        if (next === "" || Number.isFinite(n)) onChange(next === "" ? 0 : n);
      }}
    />
  );
}
