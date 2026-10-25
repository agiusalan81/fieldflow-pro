import { parseRich, RICH_COLORS } from "@/lib/rich-text";

export function RichText({ text }: { text: string }) {
  return <>{parseRich(text).map((s, i) => <span key={i} className={[s.bold && "font-semibold", s.italic && "italic", s.underline && "underline", s.color && RICH_COLORS.find(c => c.key === s.color)?.token].filter(Boolean).join(" ")}>{s.text}</span>)}</>;
}
