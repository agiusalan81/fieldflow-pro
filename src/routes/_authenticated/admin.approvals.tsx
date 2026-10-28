import {createFileRoute,Link,useNavigate} from '@tanstack/react-router';
import {z} from 'zod';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useProfile,isManager,isOffice} from '@/lib/profile';
import {usePlanFeatures} from '@/lib/plan-features';
import {useCan} from '@/lib/permissions';
import {AppShell} from '@/components/app-shell';
import {Button} from '@/components/ui/button';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {ExpenseStash} from '@/components/expense-stash';
import {useApprovalCounts} from '@/lib/approval-counts';
const Count=({n}:{n:number})=>n>0?<span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-xs font-semibold tabular-nums">{n}</span>:null;

export const Route=createFileRoute('/_authenticated/admin/approvals')({staticData:{sitemap:false},validateSearch:z.object({category:z.enum(['leave','expenses','equipment']).default('leave'),item:z.string().uuid().optional()}),head:()=>({meta:[{title:'Administration approvals — FieldBridge'},{name:'description',content:'Review leave, expense categories and equipment catalogue updates.'},{property:'og:title',content:'Administration approvals — FieldBridge'},{property:'og:description',content:'Your company review queues.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Approvals});
function Approvals(){
 const navigate=useNavigate();
 const {data:p}=useProfile(),on=usePlanFeatures(),can=useCan(p);const {category,item}=Route.useSearch();
 const allowed=!!p&&isManager(p);const leaveOn=allowed&&on('core')&&can('leave_approvals'),equipmentOn=allowed&&isOffice(p)&&on('core')&&can('approvals');
 const q=useQuery({queryKey:['approval-hub',p?.id,leaveOn,equipmentOn],enabled:allowed,refetchInterval:15000,queryFn:async()=>{const [leave,equipment]=await Promise.all([leaveOn?supabase.from('leave_requests').select('id,start_date,end_date,status').order('created_at',{ascending:false}).limit(100):Promise.resolve({data:[],error:null}),equipmentOn?supabase.from('job_sheets').select('id,jobsheet_number,lift_model,serial_number,unlisted_equipment').eq('requires_admin_approval',true).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})]);if(leave.error||equipment.error)throw leave.error??equipment.error;return{leave:leave.data??[],equipment:equipment.data??[]};}});
 const {counts}=useApprovalCounts();
 const passports=useQuery({queryKey:['passport-review-queue',p?.id],enabled:allowed&&on('lift_pack'),refetchInterval:15000,queryFn:async()=>{const r=await supabase.from('passport_submissions').select('id,asset_id,title,assets(reference_number)').eq('status','pending').order('created_at');if(r.error)throw r.error;return r.data;}});
 const categories=[...(leaveOn?['leave']:[]),...(allowed&&on('receipts')?['expenses']:[]),...(equipmentOn||allowed&&on('lift_pack')?['equipment']:[])];
 return <AppShell title="Approvals">{!allowed?<p>Reviews are available to company managers.</p>:<div className="mx-auto max-w-5xl space-y-4"><Tabs value={categories.includes(category)?category:(categories[0]??"leave")} onValueChange={v=>void navigate({to:'/admin/approvals',search:{category:v as 'leave'|'expenses'|'equipment'}})}><div className="sticky top-0 z-20 -mx-1 bg-background px-1 py-2"><TabsList className="flex h-auto w-full flex-wrap justify-start">{leaveOn&&<TabsTrigger value="leave">Leave<Count n={counts.leave}/></TabsTrigger>}{on('receipts')&&<TabsTrigger value="expenses">Expense categories<Count n={counts.expenses}/></TabsTrigger>}{(equipmentOn||allowed&&on('lift_pack'))&&<TabsTrigger value="equipment">Equipment & assets<Count n={counts.equipment}/></TabsTrigger>}</TabsList></div>
 {q.error&&<p role="alert" className="text-destructive">{q.error.message}</p>}
 <TabsContent value="leave"><ul className="divide-y">{q.data?.leave.map(r=><li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{r.start_date} → {r.end_date} · {r.status}</span><Button asChild variant="outline"><Link to="/admin/leave" search={{request:r.id}}>Open request</Link></Button></li>)}</ul>{!q.isPending&&!q.data?.leave.length&&<p className="py-4 text-muted-foreground">No leave requests.</p>}</TabsContent>
 <TabsContent value="expenses">{category==='expenses'&&on('receipts')&&<ExpenseStash focusCategory={item} reviewOnly/>}</TabsContent>
 <TabsContent value="equipment">{on('lift_pack')&&<section className="border-b pb-4"><h2 className="font-semibold">Technical passport handovers</h2>{passports.error&&<p role="alert">Handovers could not be loaded.</p>}<ul className="divide-y">{passports.data?.map(s=><li key={s.id} className="flex flex-wrap justify-between gap-3 py-3"><span>{s.assets?.reference_number} · {s.title}</span><Button asChild variant="outline"><Link to="/equipment/$assetId" params={{assetId:s.asset_id}} search={{view:'passport',submission:s.id}}>Review handover</Link></Button></li>)}</ul></section>}<ul className="divide-y">{q.data?.equipment.map(s=><li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p>Job sheet #{s.jobsheet_number}</p><p className="text-sm text-muted-foreground">{s.unlisted_equipment??[s.lift_model,s.serial_number].filter(Boolean).join(' · ')}</p></div><Button asChild variant="outline"><Link to="/admin/jobs" search={{review:s.id}}>Review equipment</Link></Button></li>)}</ul>{!q.isPending&&!q.data?.equipment.length&&!passports.data?.length&&<p className="py-4 text-muted-foreground">No equipment updates to review.</p>}</TabsContent>
 </Tabs></div>}</AppShell>;
}