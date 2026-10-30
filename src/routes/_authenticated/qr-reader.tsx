import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { QrLookup } from '@/components/qr-lookup';
export const Route = createFileRoute('/_authenticated/qr-reader')({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: 'QR reference lookup — FieldBridge' },
    { name: 'description', content: 'Find your company equipment or facility item by its QR reference.' },
    { property: 'og:title', content: 'QR reference lookup — FieldBridge' },
    { property: 'og:description', content: 'Private company equipment and facility reference lookup.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AppShell title="Scan / look up QR"><QrLookup/></AppShell>,
});