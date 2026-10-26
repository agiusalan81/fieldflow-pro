import type { QuoteSnapshot } from '@/lib/customer-quotes';
import { quoteLineTotals } from '@/lib/customer-quotes';
import { formatMoney } from '@/lib/locale';
import { QuotePhotoGallery, type QuotePhotoAccess } from './customer-quote-photos';

export function CustomerQuotePreview({ snapshot: s, photoAccess }: { snapshot: QuoteSnapshot; photoAccess?: QuotePhotoAccess }) {
  const d = s.document; const accent = /^#[0-9a-f]{6}$/i.test(s.company.primary ?? '') ? s.company.primary! : undefined; const tone = accent ? { color: accent } : undefined; const line = accent ? { borderColor: accent } : undefined; const money = (v: number) => formatMoney(v, s.currency);
  return <article className="space-y-5 bg-background text-foreground p-5 sm:p-8">
    <header className="flex flex-wrap justify-between gap-4 border-b-2 pb-4" style={line}>
      <div>{s.company.logo && <img src={s.company.logo} alt={s.company.name} className="mb-3 max-h-16 max-w-48 object-contain" />}<h2 className="text-lg font-semibold" style={tone}>{s.company.name}</h2><p className="whitespace-pre-line text-sm text-muted-foreground">{s.company.address}</p>{s.company.vat && <p className="text-sm text-muted-foreground">VAT {s.company.vat}</p>}</div>
      <div className="text-sm"><p className="font-semibold capitalize" style={tone}>{d.kind} {s.reference}</p><p>Revision {s.revision}</p><p>Issued {d.issue_date}</p><p>Valid until {d.valid_until}</p></div>
    </header>
    <section className="space-y-2"><h1 className="text-2xl font-semibold break-words" style={tone}>{d.title}</h1><p>{s.client}</p>{s.site && <p className="text-sm">{s.site}</p>}{s.equipment && <p className="text-sm">Equipment: {s.equipment}</p>}{d.scope && <p className="whitespace-pre-wrap text-sm">{d.scope}</p>}</section>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b-2 text-left" style={{ ...line, ...tone }}><th className="py-2">Item</th><th className="px-2">Qty</th><th className="px-2">Rate</th><th className="px-2">Disc.</th><th className="px-2">VAT</th><th className="text-right">Net</th></tr></thead><tbody>{d.lines.map(l => <tr key={l.id} className="border-b align-top"><td className="py-3 min-w-40 whitespace-pre-wrap">{l.description}</td><td className="px-2 py-3 whitespace-nowrap">{l.quantity} {l.unit}</td><td className="px-2 py-3 whitespace-nowrap">{money(l.rate)}</td><td className="px-2 py-3">{l.discount}%</td><td className="px-2 py-3">{l.vat}%</td><td className="py-3 text-right whitespace-nowrap">{money(quoteLineTotals(l).net)}</td></tr>)}</tbody></table></div>
    <dl className="ml-auto max-w-xs space-y-1 text-sm">{[['Subtotal', s.totals.subtotal], ['Discount', s.totals.discount], ['Net', s.totals.net], ['VAT', s.totals.vat], ['Total', s.totals.total]].map(([label, value]) => <div key={label} className={`flex justify-between gap-4${label === 'Total' ? ' border-t-2 pt-1 text-base' : ''}`} style={label === 'Total' ? { ...line, ...tone } : undefined}><dt>{label}</dt><dd className="font-semibold tabular-nums">{money(Number(value))}</dd></div>)}</dl>
    {([['Payment terms', d.payment], ['Expected work timeframe', d.timeframe], ['Exclusions', d.exclusions], ['Customer notes', d.notes]] as const).filter(([, text]) => text).map(([title, text]) => <section key={title}><h3 className="font-semibold text-sm" style={tone}>{title}</h3><p className="whitespace-pre-wrap text-sm">{text}</p></section>)}
    <QuotePhotoGallery photos={d.photos ?? []} {...(photoAccess ? { access: photoAccess } : {})} />
    {s.company.footer && <footer className="border-t pt-3 text-xs text-muted-foreground">{s.company.footer}</footer>}
  </article>;
}