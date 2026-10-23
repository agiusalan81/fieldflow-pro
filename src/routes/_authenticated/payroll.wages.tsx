import { createFileRoute } from '@tanstack/react-router';
import { PayrollPage } from '@/components/payroll-page';
export const Route=createFileRoute('/_authenticated/payroll/wages')({ staticData: { sitemap: false },validateSearch:(s:Record<string,unknown>):{employee?:string}=>typeof s['employee']==='string'?{employee:s['employee']}:{},head:()=>({meta:[{title:'Employee wages setup — FieldBridge'},{name:'description',content:'Employee wages, tax categories and year-based contribution rates.'},{property:'og:title',content:'Employee wages setup — FieldBridge'},{property:'og:description',content:'Employee wages, tax categories and year-based contribution rates.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Wages});

function Wages(){const search=Route.useSearch();return <PayrollPage section="wages" initialEmployee={search.employee}/>;}
