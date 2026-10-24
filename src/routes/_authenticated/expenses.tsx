import {createFileRoute} from '@tanstack/react-router';
import {AppShell} from '@/components/app-shell';
import {ExpenseStash} from '@/components/expense-stash';
export const Route=createFileRoute('/_authenticated/expenses')({staticData:{sitemap:false},head:()=>({meta:[{title:'Expense stash — FieldBridge'},{name:'description',content:'Private receipt scans, job sheet attachments and monthly archives.'},{property:'og:title',content:'Expense stash — FieldBridge'},{property:'og:description',content:'Private expense receipts for your field team.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=> <AppShell title="Expense stash"><ExpenseStash/></AppShell>});
