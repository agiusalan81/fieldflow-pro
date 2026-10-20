import {createFileRoute} from '@tanstack/react-router';
import {AppShell} from '@/components/app-shell';
import {TechnicalLibrary} from '@/components/technical-library';
export const Route=createFileRoute('/_authenticated/technical-library')({head:()=>({meta:[{title:'Technical library — FieldBridgeApp'},{name:'description',content:'Your company technical manuals, scans, procedures and equipment references.'},{property:'og:title',content:'Technical library — FieldBridgeApp'},{property:'og:description',content:'Search approved company technical documents and procedures.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=> <AppShell title="Technical library"><TechnicalLibrary/></AppShell>});
