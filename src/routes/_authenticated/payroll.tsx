import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { aggregatePayroll, calculateWages, datesBetween, DEFAULT_PAYROLL_POLICY, euros, officePayrollAccess, policyOn, validPayrollPeriod, type PayslipSnapshot, type WageSettings } from "@/lib/payroll";
import { downloadPayslip } from "@/lib/payroll-pdf";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [ { title: "Payroll & payslips — FieldOps" }, { name: "description", content: "Office payroll overview, paid leave, overtime, standby allowance and employee payslips." }, { property: "og:title", content: "Payroll & payslips — FieldOps" }, { property: "og:description", content: "Review employee hours, Malta wages and payroll records." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: PayrollPage,
});

const today = new Date().toISOString().slice(0,10);
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id=label.toLowerCase().replace(/[^a-z0-9]+/g,"-");
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min="0" step="0.01" value={value} onChange={e => onChange(Number(e.target.value))} /></div>;
}

function PayrollPage() {
  const { data: profile }=useProfile(), qc=useQueryClient();
  const allowed=officePayrollAccess(profile?.real_role);
  const [from,setFrom]=useState(today.slice(0,7)+"-01"), [to,setTo]=useState(today);
  const [employee,setEmployee]=useState<string | null>(null), [mode,setMode]=useState<"settings" | "pay">("pay");
  const [wage,setWage]=useState<WageSettings>({hourly_rate:0,sick_full_hours:0,sick_half_hours:0,tax_reference:""});
  const [adjustments,setAdjustments]=useState({bonus:0,tax:0,nationalInsurance:0,otherDeductions:0});
  const [notes,setNotes]=useState(""), [reviewed,setReviewed]=useState(false), [busy,setBusy]=useState(false);
  const [policy,setPolicy]=useState({...DEFAULT_PAYROLL_POLICY,effective_from:today});
  const periodValid=validPayrollPeriod(from,to), year=Number(from.slice(0,4));
  const query=useQuery({
    queryKey:["payroll",profile?.id,from,to], enabled:allowed && periodValid,
    queryFn: async () => {
      // Read every page: payroll must never silently omit employees, reports or leave.
      const all=async <T,>(request:(start:number,end:number)=>PromiseLike<{data:T[] | null;error:{message:string} | null}>) => {
        const rows:T[]=[];for(let offset=0;;offset+=500){const result=await request(offset,offset+499);if(result.error)throw new Error(result.error.message);rows.push(...(result.data ?? []));if((result.data?.length ?? 0)<500)return rows;}
      };
      const [users,reports,leaves,policies,settings,rosters,swaps,payslips,shifts]=await Promise.all([
        all((a,b)=>supabase.from("users").select("id,full_name,employee_id").order("id").range(a,b)),
        all((a,b)=>supabase.from("daily_work_reports").select("id,user_id,report_date,shift_id,standard_hours,ot15_hours,ot20_hours").gte("report_date",from).lte("report_date",to).order("id").range(a,b)),
        all((a,b)=>supabase.from("leave_requests").select("id,user_id,start_date,end_date,total_hours,leave_type,status").eq("status","approved").gte("end_date",`${year}-01-01`).lte("start_date",to).order("id").range(a,b)),
        all((a,b)=>supabase.from("payroll_policies").select("*").order("effective_from").range(a,b)),
        all((a,b)=>supabase.from("employee_payroll_settings").select("*").eq("entitlement_year",year).order("id").range(a,b)),
        all((a,b)=>supabase.from("payroll_roster_versions").select("*").lte("effective_from",to).order("effective_from").range(a,b)),
        all((a,b)=>supabase.from("standby_swaps").select("swap_date,requester_id,target_id,status").eq("status","accepted").gte("swap_date",from).lte("swap_date",to).order("id").range(a,b)),
        all((a,b)=>supabase.from("payroll_payslips").select("*").gte("period_end",`${year}-01-01`).lte("period_start",`${year}-12-31`).order("issued_at",{ascending:false}).range(a,b)),
        all((a,b)=>supabase.from("shifts").select("id,user_id,started_at,ended_at").eq("shift_type","shift").gte("started_at",from+"T00:00:00Z").lte("started_at",to+"T23:59:59Z").order("id").range(a,b)),
      ]);
      return {users,reports,leaves,policies,settings,rosters,swaps,payslips,shifts};
    },
  });
  const data=query.data;
  const defaults=policyOn(from,data?.policies ?? []);
  const getWage=(id:string):WageSettings => data?.settings.find(s=>s.user_id===id) ?? {hourly_rate:0,sick_full_hours:Number(defaults.sick_full_hours),sick_half_hours:Number(defaults.sick_half_hours),tax_reference:""};
  const rows=(data?.users ?? []).map(u=>({user:u,wage:getWage(u.id),hours:aggregatePayroll(u.id,from,to,data?.reports ?? [],data?.leaves ?? [],getWage(u.id),data?.policies ?? [],data?.rosters ?? [],data?.swaps ?? [])}));
  const selected=rows.find(r=>r.user.id===employee);
  const open=(id:string,kind:"settings"|"pay")=>{setEmployee(id);setMode(kind);setWage(getWage(id));setAdjustments({bonus:0,tax:0,nationalInsurance:0,otherDeductions:0});setNotes("");setReviewed(false);};
  const refresh=()=>qc.invalidateQueries({queryKey:["payroll"]});
  const saveWage=async()=>{
    if(!profile || !employee || !allowed)return;
    if(![wage.hourly_rate,wage.sick_full_hours,wage.sick_half_hours].every(v=>Number.isFinite(v)&&v>=0)){toast.error("Enter non-negative wage and sick-hour values.");return;}
    setBusy(true);try{const {error}=await supabase.from("employee_payroll_settings").upsert({company_id:profile.company_id,user_id:employee,entitlement_year:year,...wage,updated_at:new Date().toISOString()},{onConflict:"company_id,user_id,entitlement_year"});if(error)throw error;await refresh();setEmployee(null);toast.success("Employee payroll settings saved");}catch(e){toast.error(e instanceof Error?e.message:"Unable to save employee settings");}finally{setBusy(false);}
  };
  const savePolicy=async()=>{
    if(!profile || !allowed)return;
    if(!policy.effective_from || ![policy.standby_weekly_eur,policy.sick_full_hours,policy.sick_half_hours].every(v=>Number.isFinite(v)&&v>=0)){toast.error("Enter a date and non-negative allowance values.");return;}
    setBusy(true);try{const {error}=await supabase.from("payroll_policies").upsert({company_id:profile.company_id,...policy,country:"Malta"},{onConflict:"company_id,effective_from"});if(error)throw error;await refresh();toast.success("Allowance and company defaults saved");}catch(e){toast.error(e instanceof Error?e.message:"Unable to save payroll defaults");}finally{setBusy(false);}
  };
  const missing=(id:string)=>data?.shifts.filter(s=>s.user_id===id && (!s.ended_at || !data.reports.some(r=>r.shift_id===s.id))).length ?? 0;
  const overlap=(id:string)=>data?.payslips.some(p=>p.user_id===id && p.period_start<=to && p.period_end>=from) ?? false;
  let totals: ReturnType<typeof calculateWages> | null=null, calculationError="";
  if(selected){try{totals=calculateWages(selected.hours,Number(selected.wage.hourly_rate),adjustments);}catch(e){calculationError=e instanceof Error?e.message:"Invalid wage calculation";}}
  const issue=async()=>{
    if(!profile || !selected || !totals || !allowed || !reviewed || overlap(selected.user.id) || missing(selected.user.id))return;
    setBusy(true);try{
      const snapshot:PayslipSnapshot={employee:selected.user.full_name,employeeCode:selected.user.employee_id ?? "",company:profile.companies?.name ?? "Company",taxReference:selected.wage.tax_reference ?? "",from,to,rate:Number(selected.wage.hourly_rate),hours:selected.hours,adjustments,totals,notes};
      const {data:issued,error}=await supabase.from("payroll_payslips").insert({company_id:profile.company_id,user_id:selected.user.id,period_start:from,period_end:to,snapshot:snapshot as unknown as Json,gross_eur:totals.gross,net_eur:totals.net,created_by:profile.id}).select("id").single();
      if(error)throw error;await refresh();toast.success("Payslip issued and saved");setEmployee(null);
      try{await downloadPayslip(snapshot,issued.id);}catch{toast.error("Payslip saved. Retry the PDF download from Issued payslips.");}
    }catch(e){toast.error(e instanceof Error?e.message:"Unable to issue payslip");}finally{setBusy(false);}
  };
  const exportReport=()=>{
    const header=["Employee","Normal hours","Paid leave hours","Sick full hours","Sick half hours","Sick unpaid hours","OT 1.5 hours","OT 2 hours","Standby days","Standby EUR"];
    const csv=[header,...rows.map(r=>[r.user.full_name,r.hours.normal,r.hours.leave,r.hours.sickFull,r.hours.sickHalf,r.hours.sickUnpaid,r.hours.ot15,r.hours.ot20,r.hours.standbyDays,r.hours.standbyPay])].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""').replace(/^[=+@-]/,"'")}"`).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`Payroll_${from}_${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
  };
  return <AppShell title="Payroll & payslips">
    {!allowed ? <p className="text-muted-foreground">Payroll is available only to office admins and the company superuser.</p> : <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end gap-3"><div className="space-y-1.5"><Label htmlFor="payroll-from">From</Label><Input id="payroll-from" type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="payroll-to">To</Label><Input id="payroll-to" type="date" value={to} onChange={e=>setTo(e.target.value)} /></div><span className="pb-2 text-sm text-muted-foreground">Malta · EUR · {datesBetween(from,to).length} days</span></div>
      {!periodValid && <p role="alert" className="text-destructive">Choose a valid date range within one calendar year.</p>}
      {query.isLoading && <p>Loading payroll records…</p>}
      {query.error && <div role="alert" className="text-destructive">{query.error.message}<Button variant="outline" onClick={()=>query.refetch()} className="ml-3">Retry</Button></div>}
      {data && periodValid && <Tabs defaultValue="overview">
        <TabsList className="flex h-auto w-fit flex-wrap"><TabsTrigger value="overview">Employee overview</TabsTrigger><TabsTrigger value="payslips">Issued payslips</TabsTrigger><TabsTrigger value="defaults">Allowances & defaults</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">{[["Normal hours",rows.reduce((s,r)=>s+r.hours.normal,0).toFixed(2)+" h"],["Overtime",rows.reduce((s,r)=>s+r.hours.ot15+r.hours.ot20,0).toFixed(2)+" h"],["Standby allowance",euros(rows.reduce((s,r)=>s+r.hours.standbyPay,0))]].map(([label,value])=><div key={label} className="border-b py-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>)}</div>
          <div className="flex items-center justify-between gap-3"><h2 className="font-medium">{rows.length} registered employees</h2><Button variant="outline" onClick={exportReport}><Download className="mr-2 h-4 w-4" />Export hours report</Button></div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Normal h</TableHead><TableHead>Leave h</TableHead><TableHead>Sick full / half h</TableHead><TableHead>OT 1.5× h</TableHead><TableHead>OT 2× h</TableHead><TableHead>Standby</TableHead><TableHead>Hourly wage</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.user.id}><TableCell className="min-w-40 font-medium">{r.user.full_name}<p className="text-xs text-muted-foreground">{r.user.employee_id}</p>{missing(r.user.id)>0 && <p className="text-xs text-destructive">{missing(r.user.id)} shifts need a daily report</p>}</TableCell><TableCell>{r.hours.normal.toFixed(2)}</TableCell><TableCell>{r.hours.leave.toFixed(2)}</TableCell><TableCell>{r.hours.sickFull.toFixed(2)} / {r.hours.sickHalf.toFixed(2)}{r.hours.sickUnpaid>0 && <p className="text-xs text-destructive">{r.hours.sickUnpaid.toFixed(2)} unpaid</p>}</TableCell><TableCell>{r.hours.ot15.toFixed(2)}</TableCell><TableCell>{r.hours.ot20.toFixed(2)}</TableCell><TableCell className="whitespace-nowrap">{euros(r.hours.standbyPay)}<p className="text-xs text-muted-foreground">{r.hours.standbyDays} days</p></TableCell><TableCell>{Number(r.wage.hourly_rate)>0 ? euros(Number(r.wage.hourly_rate)):"Not set"}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Wage settings for ${r.user.full_name}`} title="Wage & sick leave settings" onClick={()=>open(r.user.id,"settings")}><Settings2 className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={()=>open(r.user.id,"pay")}>Calculate pay</Button></div></TableCell></TableRow>)}</TableBody></Table></div>
        </TabsContent>
        <TabsContent value="payslips"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead>Gross</TableHead><TableHead>Net</TableHead><TableHead>Issued</TableHead><TableHead>PDF</TableHead></TableRow></TableHeader><TableBody>{data.payslips.map(p=>{const s=p.snapshot as unknown as PayslipSnapshot;return <TableRow key={p.id}><TableCell>{s.employee}</TableCell><TableCell className="whitespace-nowrap">{p.period_start} — {p.period_end}</TableCell><TableCell>{euros(Number(p.gross_eur))}</TableCell><TableCell>{euros(Number(p.net_eur))}</TableCell><TableCell>{new Date(p.issued_at).toLocaleDateString("en-MT")}</TableCell><TableCell><Button variant="outline" size="icon" aria-label={`Download payslip for ${s.employee}`} onClick={()=>downloadPayslip(s,p.id).catch(()=>toast.error("Unable to download PDF"))}><Download className="h-4 w-4" /></Button></TableCell></TableRow>;})}</TableBody></Table>{!data.payslips.length && <p className="py-6 text-muted-foreground">No payslips issued for this year.</p>}</div></TabsContent>
        <TabsContent value="defaults" className="space-y-5">
          <h2 className="pt-3 font-medium">Standby allowance & annual sick-leave defaults</h2>
          <div className="grid max-w-3xl gap-4 sm:grid-cols-2"><NumberField label="Standby allowance per 7 days (€)" value={policy.standby_weekly_eur} onChange={v=>setPolicy({...policy,standby_weekly_eur:v})} /><div className="space-y-1.5"><Label htmlFor="allowance-effective">Effective from</Label><Input id="allowance-effective" type="date" value={policy.effective_from} onChange={e=>setPolicy({...policy,effective_from:e.target.value})} /></div><NumberField label="Annual full-pay sick hours (default)" value={policy.sick_full_hours} onChange={v=>setPolicy({...policy,sick_full_hours:v})} /><NumberField label="Annual half-pay sick hours (default)" value={policy.sick_half_hours} onChange={v=>setPolicy({...policy,sick_half_hours:v})} /></div>
          <p className="text-sm text-muted-foreground">Sick entitlements are unset until entered. Existing employee allowances remain unchanged.</p>
          <Button disabled={busy} onClick={savePolicy}>Save allowance & defaults</Button>
          <Table><TableHeader><TableRow><TableHead>Effective from</TableHead><TableHead>Standby / 7 days</TableHead><TableHead>Full sick h</TableHead><TableHead>Half sick h</TableHead></TableRow></TableHeader><TableBody>{data.policies.map(p=><TableRow key={p.id}><TableCell>{p.effective_from}</TableCell><TableCell>{euros(Number(p.standby_weekly_eur))}</TableCell><TableCell>{p.sick_full_hours}</TableCell><TableCell>{p.sick_half_hours}</TableCell></TableRow>)}</TableBody></Table>
        </TabsContent>
      </Tabs>}
    </div>}
    <Dialog open={!!employee} onOpenChange={o=>!o && setEmployee(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{mode==="settings"?"Wage & sick leave settings":"Calculate wages"} · {selected?.user.full_name}</DialogTitle></DialogHeader>
      {selected && (mode==="settings"?<div className="space-y-4"><p className="text-sm text-muted-foreground">Annual entitlement year: {year}</p><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Hourly wage (€)" value={Number(wage.hourly_rate)} onChange={v=>setWage({...wage,hourly_rate:v})} /><div className="space-y-1.5"><Label htmlFor="tax-reference">Employee tax reference</Label><Input id="tax-reference" value={wage.tax_reference ?? ""} onChange={e=>setWage({...wage,tax_reference:e.target.value})} /></div><NumberField label="Annual full-pay sick hours" value={Number(wage.sick_full_hours)} onChange={v=>setWage({...wage,sick_full_hours:v})} /><NumberField label="Annual half-pay sick hours" value={Number(wage.sick_half_hours)} onChange={v=>setWage({...wage,sick_half_hours:v})} /></div><p className="text-sm text-muted-foreground">Used this year through {to}: full {selected.hours.fullUsed.toFixed(2)} h · half {selected.hours.halfUsed.toFixed(2)} h</p><Button disabled={busy} onClick={saveWage}>Save employee settings</Button></div>:<div className="space-y-4">
        <p className="text-sm text-muted-foreground">{from} — {to} · Hourly wage {euros(Number(selected.wage.hourly_rate))}</p>
        {Number(selected.wage.hourly_rate)<=0 && <p className="text-destructive">Set this employee’s hourly wage before issuing a payslip.</p>}
        {missing(selected.user.id)>0 && <p className="text-destructive">Finish missing daily reports before issuing this payslip.</p>}
        {overlap(selected.user.id) && <p className="text-destructive">An issued payslip already covers part of this period.</p>}
        <div className="grid gap-3 sm:grid-cols-2"><NumberField label="Other earnings / bonus (€)" value={adjustments.bonus} onChange={v=>{setReviewed(false);setAdjustments({...adjustments,bonus:v});}} /><NumberField label="Income tax FSS (€)" value={adjustments.tax} onChange={v=>{setReviewed(false);setAdjustments({...adjustments,tax:v});}} /><NumberField label="Employee national insurance (€)" value={adjustments.nationalInsurance} onChange={v=>{setReviewed(false);setAdjustments({...adjustments,nationalInsurance:v});}} /><NumberField label="Other deductions (€)" value={adjustments.otherDeductions} onChange={v=>{setReviewed(false);setAdjustments({...adjustments,otherDeductions:v});}} /></div>
        {calculationError && <p className="text-destructive">{calculationError}</p>}
        {totals && <dl className="grid grid-cols-2 gap-y-2 border-y py-4 text-sm">{[["Full-pay normal hours",euros(totals.normalPay)],["Half-pay sick leave",euros(totals.halfPay)],["Overtime 1.5×",euros(totals.ot15Pay)],["Overtime 2×",euros(totals.ot20Pay)],["Standby allowance",euros(selected.hours.standbyPay)],["Gross pay",euros(totals.gross)],["Deductions",euros(totals.deductions)],["Net pay",euros(totals.net)]].map(([k,v])=><div key={k} className="contents"><dt>{k}</dt><dd className="text-right font-medium tabular-nums">{v}</dd></div>)}</dl>}
        <div className="space-y-1.5"><Label htmlFor="payroll-notes">Payslip notes</Label><Textarea id="payroll-notes" value={notes} onChange={e=>setNotes(e.target.value)} /></div>
        <label className="flex items-start gap-2 text-sm"><Checkbox checked={reviewed} onCheckedChange={v=>setReviewed(v===true)} aria-label="Confirm payroll review" /><span>I have reviewed hours, paid leave, income tax and national insurance for Malta.</span></label>
        <Button disabled={busy || !reviewed || !totals || Number(selected.wage.hourly_rate)<=0 || missing(selected.user.id)>0 || overlap(selected.user.id)} onClick={issue}><FileCheck className="mr-2 h-4 w-4" />{busy?"Issuing…":"Issue & download payslip"}</Button>
      </div>)}
    </DialogContent></Dialog>
  </AppShell>;
}