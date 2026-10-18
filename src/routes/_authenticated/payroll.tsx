import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/payroll')({beforeLoad:({location})=>{if(location.pathname==='/payroll')throw redirect({to:'/payroll/hours',replace:true});},component:Outlet});
