import {createFileRoute} from '@tanstack/react-router';
import {lazy,Suspense,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {AppShell,EmptyState} from '@/components/app-shell';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {supabase} from '@/integrations/supabase/client';
import {isManager,isOffice,useProfile,useCompanyUsers} from '@/lib/profile';
import {usePlanFeatures} from '@/lib/plan-features';
import {useCompanyRules} from '@/lib/company';
import {fleetSummary,type FleetPoint,type FleetVehicle} from '@/lib/fleet';
const RouteMap=lazy(()=>import('@/components/fleet-route-map'));
export const Route=createFileRoute('/_authenticated/fleet')({head:()=>({meta:[{title:'Fleet Management — FieldBridgeApp'},{name:'description',content:'Company vehicle routes, recorded mileage and fuel estimates.'},{property:'og:title',content:'Fleet Management — FieldBridgeApp'},{property:'og:description',content:'Review daily technician routes and estimated fleet costs.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:FleetPage});
function FleetPage(){const{data:profile}=useProfile();const on=usePlanFeatures();return <AppShell title="Fleet Management">{profile&&isManager(profile)&&on('fleet_management')?<FleetWorkspace/>:<EmptyState>Fleet Management requires a company plan with this module and supervisor or office access.</EmptyState>}</AppShell>;}
function FleetWorkspace(){
 const{data:profile}=useProfile();const{data:users=[]}=useCompanyUsers();const{data:company}=useCompanyRules();const qc=useQueryClient();
 const[user,setUser]=useState(''),[date,setDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Malta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 const[plate,setPlate]=useState(''),[litres,setLitres]=useState(''),[price,setPrice]=useState(''),[busy,setBusy]=useState(false);
 const selected=user||profile?.id||'';
 const points=useQuery({queryKey:['fleet-day',selected,date],enabled:!!selected,refetchInterval:30000,queryFn:async()=>{const r=await supabase.rpc('fleet_day',{_user:selected,_date:date});if(r.error)throw r.error;return r.data as unknown as FleetPoint[];}});
 const vehicles=useQuery({queryKey:['fleet-vehicles'],queryFn:async()=>{const r=await supabase.rpc('fleet_vehicle_list');if(r.error)throw r.error;return r.data as unknown as FleetVehicle[];}});
 const summary=fleetSummary(points.data??[],vehicles.data??[]);
 const save=async()=>{setBusy(true);try{const r=await supabase.rpc('save_fleet_vehicle',{_plate:plate,_litres:Number(litres),_price:Number(price)});if(r.error)throw r.error;await qc.invalidateQueries({queryKey:['fleet-vehicles']});toast.success('Vehicle saved');}catch(e){toast.error(e instanceof Error?e.message:'Could not save vehicle');}finally{setBusy(false);}};
 return <div className="mx-auto max-w-6xl space-y-6">
  <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="fleet-user">Team member</Label><select id="fleet-user" className="h-11 w-full rounded-md border bg-background px-3 text-foreground" value={selected} onChange={e=>setUser(e.target.value)}>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></div><div className="space-y-1"><Label htmlFor="fleet-date">Date (Malta time)</Label><Input id="fleet-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div></div>
  <div className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-4">{[['Recorded mileage',`${summary.km.toFixed(2)} km`],['Estimated fuel',`${summary.litres.toFixed(2)} L`],['Estimated cost',`${summary.cost.toFixed(2)} ${company?.locale.currency??'EUR'}`],['GPS readings',String(points.data?.length??0)]].map(([label,value])=><div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold tabular-nums">{value}</p></div>)}</div>
  {points.error||vehicles.error?<p role="alert" className="text-destructive">{(points.error||vehicles.error)?.message}</p>:points.isPending?<p>Loading routes…</p>:points.data?.length?<Suspense fallback={<div className="h-96 bg-muted"/>}><RouteMap points={points.data} segments={summary.segments}/></Suspense>:<EmptyState>No GPS history recorded for this member on this date.</EmptyState>}
  <p className="text-sm text-muted-foreground">GPS estimates only. Tracking may pause when the browser is closed or the phone is locked. {summary.gaps>0?`${summary.gaps} tracking gaps excluded. `:''}{summary.unconfiguredKm>0?`${summary.unconfiguredKm.toFixed(2)} km has no configured fuel consumption.`:''}</p>
  <section className="space-y-3"><h2 className="font-medium">Vehicles & fuel</h2>{vehicles.data?.map(v=><div key={v.plate} className="flex flex-wrap items-center justify-between gap-2 border-b py-2"><span>{v.plate} · {v.litres_per_100km} L/100 km · {v.fuel_price_per_litre} {company?.locale.currency??'EUR'}/L</span>{isOffice(profile)&&<Button variant="ghost" size="sm" onClick={()=>{setPlate(v.plate);setLitres(String(v.litres_per_100km));setPrice(String(v.fuel_price_per_litre));}}>Edit</Button>}</div>)}
  {isOffice(profile)&&<form onSubmit={e=>{e.preventDefault();void save();}} className="grid items-end gap-3 sm:grid-cols-4"><div><Label htmlFor="fleet-plate">Vehicle plate</Label><Input id="fleet-plate" required pattern="[A-Za-z]{3}[0-9]{3}" maxLength={6} placeholder="ABC123" value={plate} onChange={e=>setPlate(e.target.value.toUpperCase())}/></div><div><Label htmlFor="fleet-litres">Litres / 100 km</Label><Input id="fleet-litres" type="number" min="0" max="100" step="0.01" required value={litres} onChange={e=>setLitres(e.target.value)}/></div><div><Label htmlFor="fleet-price">Fuel price / litre</Label><Input id="fleet-price" type="number" min="0" max="100" step="0.001" required value={price} onChange={e=>setPrice(e.target.value)}/></div><Button type="submit" disabled={busy}>{busy?'Saving…':'Save vehicle'}</Button></form>}</section>
  {isOffice(profile)&&<section className="space-y-2"><h2 className="font-medium">GPS settings</h2><Label htmlFor="fleet-ping">Update interval</Label><select id="fleet-ping" className="h-11 rounded-md border bg-background px-3 text-foreground" value={company?.pingSeconds??30} onChange={async e=>{if(!profile)return;const r=await supabase.from('company_settings').upsert({company_id:profile.company_id,location_ping_seconds:Number(e.target.value)});if(r.error)toast.error(r.error.message);else{await qc.invalidateQueries({queryKey:['company-settings']});toast.success('GPS interval saved');}}}>{[15,30,60,120,300].map(n=><option key={n} value={n}>{n} seconds</option>)}</select></section>}
 </div>;
}