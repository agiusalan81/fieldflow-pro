import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseTemplate } from "@/lib/documents";
import { formatOfficeAddress, parseOfficeAddress } from "@/lib/contact-details";

/** A4 at 96 dpi. Pages render at true size and scale down to fit the container. */
const PAGE_W = 794, PAGE_H = 1123, PAD = 56, HEADER_H = 88, FOOTER_H = 56;
const BODY_H = PAGE_H - PAD * 2 - HEADER_H - FOOTER_H;

/** Splits blocks into pages by their measured heights; a block taller than a page gets its own page. */
export function paginate(heights: number[], available: number): number[][] {
  const pages: number[][] = [[]]; let used = 0;
  heights.forEach((h, i) => {
    const page = pages[pages.length - 1]!;
    if (page.length && used + h > available) { pages.push([i]); used = h; } else { page.push(i); used += h; }
  });
  return pages;
}

function useLetterhead() {
  return useQuery({ queryKey: ["a4-letterhead"], staleTime: 60_000, queryFn: async () => {
    const [s, c] = await Promise.all([
      supabase.from("company_settings").select("logo_data, pdf_template, office_address, company_address, vat_number").maybeSingle(),
      supabase.from("companies").select("name").maybeSingle(),
    ]);
    const t = parseTemplate(s.data?.pdf_template);
    return { logo: s.data?.logo_data ?? "", name: c.data?.name ?? "", header: t.header, footer: t.footer, primary: t.primaryColor,
      address: formatOfficeAddress(parseOfficeAddress(s.data?.office_address, s.data?.company_address ?? "")).replace(/\n/g, " · "), vat: s.data?.vat_number ?? "" };
  } });
}

export function A4Document({ title, subtitle, blocks }: { title: string; subtitle?: string; blocks: ReactNode[] }) {
  const { data: lh } = useLetterhead();
  const outer = useRef<HTMLDivElement>(null), measure = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5); const [pages, setPages] = useState<number[][]>([blocks.map((_, i) => i)]);
  useLayoutEffect(() => {
    const el = outer.current; if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / PAGE_W));
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const kids = measure.current ? Array.from(measure.current.children) as HTMLElement[] : [];
    setPages(paginate(kids.map((k) => k.offsetHeight + 12), BODY_H));
  }, [blocks]);
  const accent = lh?.primary ?? "currentColor";
  return <div ref={outer} className="w-full">
    <div ref={measure} aria-hidden className="pointer-events-none absolute -left-[9999px] top-0 text-[13px] leading-relaxed" style={{ width: PAGE_W - PAD * 2 }}>{blocks.map((b, i) => <div key={i}>{b}</div>)}</div>
    <div className="space-y-4">{pages.map((idx, p) => <div key={p} style={{ height: PAGE_H * scale }} className="mx-auto overflow-hidden" >
      <div className="document-paper origin-top-left border shadow-md" style={{ width: PAGE_W, height: PAGE_H, padding: PAD, transform: `scale(${scale})` }}>
        <header className="flex items-start justify-between gap-4 border-b-2 pb-3" style={{ height: HEADER_H, borderColor: accent }}>
          <div className="flex items-center gap-3">{lh?.logo && <img src={lh.logo} alt="Company logo" className="h-12 max-w-32 object-contain" />}<div><p className="text-base font-semibold">{lh?.name}</p>{lh?.header && <p className="text-[11px] opacity-70">{lh.header}</p>}</div></div>
          <div className="text-right"><p className="text-sm font-semibold" style={{ color: accent }}>{title}</p>{subtitle && <p className="text-[11px] opacity-70">{subtitle}</p>}</div>
        </header>
        <main className="space-y-3 py-4 text-[13px] leading-relaxed" style={{ height: BODY_H + 32 }}>{idx.map((i) => <div key={i}>{blocks[i]}</div>)}</main>
        <footer className="flex items-end justify-between gap-4 border-t pt-2 text-[10px] opacity-80" style={{ height: FOOTER_H }}>
          <span>{[lh?.footer, lh?.address, lh?.vat && `VAT ${lh.vat}`].filter(Boolean).join(" · ")}</span><span className="shrink-0">Page {p + 1} of {pages.length}</span>
        </footer>
      </div>
    </div>)}</div>
  </div>;
}
