import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { QrLookup } from '@/components/qr-lookup';
export const Route = createFileRoute('/_authenticated/qr-reader')({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: 'Camera QR scan & reference lookup — FieldBridge' },
    { name: 'description', content: 'Scan equipment QR codes with your camera or look up a printed company reference.' },
    { property: 'og:title', content: 'Camera QR scan & reference lookup — FieldBridge' },
    { property: 'og:description', content: 'Private company equipment camera scanning and reference lookup.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AppShell title="Scan / look up QR"><QrLookup/></AppShell>,
});