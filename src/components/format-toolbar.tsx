import { Bold, Italic, Underline } from "lucide-react";
import { RICH_COLORS, wrapSelection } from "@/lib/rich-text";
import { Button } from "@/components/ui/button";

const SWATCH: Record<string, string> = { red: "bg-destructive", amber: "bg-warning", blue: "bg-primary", green: "bg-success" };

/** Shared bold/italic/underline/colour toolbar for textareas that store rich-text markers. */
export function FormatToolbar({ target, onText, label = "Text formatting" }: { target: React.RefObject<HTMLTextAreaElement | null>; onText: (text: string) => void; label?: string }) {
  const format = (open: string, close = open) => {
    const el = target.current; if (!el) return;
    if (el.selectionStart === el.selectionEnd) return;
    const r = wrapSelection(el.value, el.selectionStart, el.selectionEnd, open, close);
    onText(r.text);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); });
  };
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return <div role="toolbar" aria-label={label} className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
    <Button type="button" size="icon" variant="ghost" title="Bold" aria-label="Bold" onMouseDown={keep} onClick={() => format("**")}><Bold className="h-4 w-4" /></Button>
    <Button type="button" size="icon" variant="ghost" title="Italic" aria-label="Italic" onMouseDown={keep} onClick={() => format("*")}><Italic className="h-4 w-4" /></Button>
    <Button type="button" size="icon" variant="ghost" title="Underline" aria-label="Underline" onMouseDown={keep} onClick={() => format("__")}><Underline className="h-4 w-4" /></Button>
    <span className="mx-1 h-5 w-px bg-border" />
    {RICH_COLORS.map(c => <button key={c.key} type="button" title={c.label} aria-label={`Colour ${c.label}`} onMouseDown={keep} onClick={() => format(`[${c.key}]`, `[/${c.key}]`)} className={`h-5 w-5 rounded-full border ${SWATCH[c.key]}`} />)}
  </div>;
}
