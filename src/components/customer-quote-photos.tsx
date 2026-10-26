import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/lib/profile';
import type { QuoteDocument } from '@/lib/customer-quotes';
import { resolveQuotePhotos, resolveSharedQuotePhotos, resolvePortalQuotePhotos } from '@/lib/customer-quote-photos.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type QuotePhotoAccess = { quoteId: string; photoIds?: string[] } | { token: string } | { clientId: string; quoteId: string };
export function useQuotePhotoUrls(access: QuotePhotoAccess | undefined, enabled: boolean) {
  const office = useServerFn(resolveQuotePhotos); const shared = useServerFn(resolveSharedQuotePhotos); const portal = useServerFn(resolvePortalQuotePhotos);
  return useQuery({ queryKey: ['quote-photo-urls', access], enabled: !!access && enabled, staleTime: 240_000, refetchInterval: 240_000,
    queryFn: async () => { if (!access) return {}; if ('token' in access) return shared({ data: access }); if ('clientId' in access) return portal({ data: access }); return office({ data: access }); },
  });
}
export function QuotePhotoGallery({ photos, access }: { photos: QuoteDocument['photos']; access?: QuotePhotoAccess }) {
  const urls = useQuotePhotoUrls(access, photos.length > 0);
  if (!photos.length) return null;
  return <section className="space-y-3"><h3 className="text-sm font-semibold">Photos</h3>{urls.error && <p role="alert" className="text-sm text-destructive">Photos could not be loaded.</p>}<div className="grid gap-4 sm:grid-cols-2">{photos.map(p => <figure key={p.id} className="space-y-2">{urls.data?.[p.id] ? <img src={urls.data[p.id]} alt={p.caption || 'Quote photo'} className="aspect-[4/3] w-full rounded-md border object-contain" /> : <div className="aspect-[4/3] border bg-muted flex items-center justify-center text-sm text-muted-foreground">{urls.isPending ? 'Loading photo…' : 'Photo unavailable'}</div>}{p.caption && <figcaption className="whitespace-pre-wrap text-sm">{p.caption}</figcaption>}</figure>)}</div></section>;
}
export function QuotePhotoEditor({ quoteId, photos, disabled, onChange }: { quoteId: string; photos: QuoteDocument['photos']; disabled: boolean; onChange: (photos: QuoteDocument['photos']) => void }) {
  const { data: profile } = useProfile(); const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false);
  const urls = useQuotePhotoUrls({ quoteId, photoIds: photos.map(p => p.id) }, photos.length > 0);
  const upload = async (file: File) => {
    if (!profile || disabled) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024 || photos.length >= 10) { toast.error('Choose a JPG, PNG or WebP photo up to 20 MB; maximum 10 photos.'); return; }
    setBusy(true); let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file); const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Photo could not be prepared');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
      if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('Photo is too large');
      const id = crypto.randomUUID(); const path = `${profile.company_id}/${id}.jpg`;
      const up = await supabase.storage.from('quote-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }); if (up.error) throw up.error;
      const meta = await supabase.from('customer_quote_photos').insert({ id, company_id: profile.company_id, storage_path: path });
      if (meta.error) { await supabase.storage.from('quote-photos').remove([path]); throw meta.error; }
      onChange([...photos, { id, caption: '' }]);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Photo upload failed'); } finally { bitmap?.close(); setBusy(false); if (input.current) input.current.value = ''; }
  };
  return <section className="space-y-3 border-y py-4"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Customer photos</h2>{!disabled && <Button variant="outline" disabled={busy || photos.length >= 10} onClick={() => input.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />{busy ? 'Uploading…' : 'Add photo'}</Button>}</div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Quote photo upload" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} /><div className="grid gap-4 sm:grid-cols-2">{photos.map((p, i) => <div key={p.id} className="space-y-2">{urls.data?.[p.id] && <img className="aspect-[4/3] w-full rounded-md border object-contain" src={urls.data[p.id]} alt={p.caption || `Quote photo ${i + 1}`} />}<div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Label htmlFor={`caption-${p.id}`}>Photo {i + 1} caption</Label><Input id={`caption-${p.id}`} maxLength={500} disabled={disabled} value={p.caption} onChange={e => onChange(photos.map(x => x.id === p.id ? { ...x, caption: e.target.value } : x))} /></div>{!disabled && <Button variant="ghost" size="icon" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(photos.filter(x => x.id !== p.id))}><Trash2 className="h-4 w-4" /></Button>}</div></div>)}</div></section>;
}