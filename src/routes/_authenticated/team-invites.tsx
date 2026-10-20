import {createFileRoute} from '@tanstack/react-router';
import {AppShell,EmptyState} from '@/components/app-shell';
import {TeamManagement} from '@/components/team-management';
import {isManager,useProfile} from '@/lib/profile';
export const Route=createFileRoute('/_authenticated/team-invites')({head:()=>({meta:[{title:'Team invites — FieldBridgeApp'},{name:'description',content:'Invite colleagues to your FieldBridge company.'},{property:'og:title',content:'Team invites — FieldBridgeApp'},{property:'og:description',content:'Manage single-use team invitations.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:Invites});
function Invites(){const{data:profile}=useProfile();return <AppShell title="Invites">{profile&&isManager(profile)?<TeamManagement role={profile.role} companyId={profile.company_id} meId={profile.id} tab="invites"/>:<EmptyState>Invites are available to supervisors and office staff.</EmptyState>}</AppShell>;}