import {createFileRoute} from '@tanstack/react-router';
import {z} from 'zod';
import {AppShell} from '@/components/app-shell';
import {ExpenseStash} from '@/components/expense-stash';
import {useProfile,isOffice} from '@/lib/profile';
export const Route=createFileRoute('/_authenticated/expenses')({staticData:{sitemap:false},validateSearch:z.object({category:z.string().uuid().optional()}),head:()=>({meta:[{title:'Expenses & receipts — FieldBridge'},{name:'description',content:'Private receipt scans, job sheet attachments and monthly archives.'},{property:'og:title',content:'Expenses & receipts — FieldBridge'},{property:'og:description',content:'Private expense receipts for your field team.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Expenses});
function Expenses(){const {category}=Route.useSearch();const {data:profile}=useProfile();return <AppShell title={isOffice(profile)?'Expenses & receipts':'Log expense'}><ExpenseStash focusCategory={category}/></AppShell>;}
