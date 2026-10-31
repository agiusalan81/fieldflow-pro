import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {billingBalance,type BillingSnapshot} from './client-billing';
import {customerQuoteDocument,type QuoteSnapshot} from './customer-quotes';
import {clientRecipients} from './client-recipients';
import {reminderRules,reminderRulesSchema,reminderQueue,targetOpen,type ReminderTarget,type FollowupState} from './finance-reminders';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database,Json} from '@/integrations/supabase/types';

async function office(sb:SupabaseClient<Database>){const [a,c]=await Promise.all([sb.rpc('client_billing_can'),sb.rpc('current_company_id')]);if(a.error||!a.data||c.error||!c.data)throw new Error('Contractor office access required');const on=await sb.rpc('company_module_access',{_company:c.data,_module:'core'});if(on.error||!on.data)throw new Error('Active Core access required');return c.data;}
async function workspace(sb:SupabaseClient<Database>){
 await office(sb);
 // Fail closed instead of calculating balances from a truncated payment history.
 const payments: {document_id:string;amount:number}[]=[];
 for(let offset=0;;offset+=500){const page=await sb.from('client_billing_payments').select('document_id,amount').order('id').range(offset,offset+499);if(page.error)throw new Error('Payment history unavailable');payments.push(...page.data);if(page.data.length<500)break;}
 const [b,q,s,c]=await Promise.all([sb.from('client_billing_documents').select('*,clients(name)').not('issued_at','is',null).order('issued_at',{ascending:false}).limit(1000),sb.from('customer_quotes').select('*,clients(name)').not('issued_at','is',null).order('issued_at',{ascending:false}).limit(1000),sb.from('finance_followups').select('*'),sb.from('client_billing_settings').select('reminder_rules').maybeSingle()]);
 const p={data:payments,error:null};
 if(b.error||q.error||p.error||s.error||c.error)throw new Error('Could not load follow-up records');
 const targets:ReminderTarget[]=[];
 for(const row of b.data??[]){const snap=row.snapshot as unknown as BillingSnapshot; if(!snap?.document)continue;const paid=(p.data??[]).filter(x=>x.document_id===row.id||x.document_id===row.source_document_id).reduce((n,x)=>n+Number(x.amount),0);targets.push({id:row.id,type:snap.kind,reference:snap.reference,title:snap.document.title,client:row.clients?.name??snap.client.name,issued:snap.document.issue_date,due:snap.document.due_date,balance:billingBalance(snap.totals.total,paid),currency:snap.currency,status:'issued',converted:(b.data??[]).some(x=>x.source_document_id===row.id)});}
 for(const row of q.data??[]){const snap=row.snapshot as unknown as QuoteSnapshot;if(!snap?.document)continue;const doc=customerQuoteDocument(snap.document);targets.push({id:row.id,type:'quote',reference:snap.reference,title:doc.title,client:row.clients?.name??snap.client,issued:doc.issue_date,due:doc.valid_until,balance:0,currency:snap.currency,status:row.status,converted:false});}
 return {targets,states:(s.data??[]) as FollowupState[],rules:reminderRules(c.data?.reminder_rules)};
}
export const getFinanceWorkspace=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>workspace(context.supabase));
export const saveFinanceRules=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>reminderRulesSchema.parse(input)).handler(async({data,context})=>{const company=await office(context.supabase);const r=await context.supabase.from('client_billing_settings').upsert({company_id:company,reminder_rules:data as unknown as Json});if(r.error)throw r.error;return {saved:true};});
export const financeFollowupAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({target:z.string().uuid(),action:z.enum(['pause','resume','snooze','complete','send']),stage:z.string().max(30).optional(),contactId:z.string().max(100).optional(),until:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).parse(input)).handler(async({data,context})=>{
 const sb=context.supabase;const company=await office(sb);const w=await workspace(sb);const target=w.targets.find(t=>t.id===data.target);if(!target||!targetOpen(target))throw new Error('Document paid, decided, converted or unavailable');
 const existing=w.states.find(s=>(s.billing_id??s.quote_id)===target.id);const key=target.type==='quote'?'quote_id':'billing_id';
 const initial=await sb.from('finance_followups').upsert({company_id:company,[key]:target.id,...(existing?{id:existing.id}: {})},{onConflict:key,ignoreDuplicates:true}).select('id');if(initial.error)throw initial.error;
 const row=await sb.from('finance_followups').select('*').eq(key,target.id).single();if(row.error)throw row.error;
 const activity=Array.isArray(row.data.activity)?row.data.activity:[];
 let patch:Database['public']['Tables']['finance_followups']['Update']={};let outcome=data.action as string;
 if(data.action==='pause')patch={paused:true};
 if(data.action==='resume')patch={paused:false,snoozed_until:null};
 if(data.action==='snooze'){if(!data.until||data.until<=new Date().toISOString().slice(0,10))throw new Error('Choose a future snooze date');patch={snoozed_until:data.until};}
 if(data.action==='complete'||data.action==='send'){
  const stage=reminderQueue([target],[row.data as FollowupState],w.rules).find(x=>x.key===data.stage);if(!stage)throw new Error('Reminder completed, paused or disabled');
  if(data.action==='send'){
   let client:string|null=null,site:string|null=null,purpose:'invoice'|'estimate'|'proposal'='invoice',url='';
   if(target.type==='quote'){const q=await sb.from('customer_quotes').select('client_id,site_id,snapshot').eq('id',target.id).single();if(q.error)throw q.error;client=q.data.client_id;site=q.data.site_id;const snap=q.data.snapshot as unknown as QuoteSnapshot;purpose=snap.document.kind==='proposal'?'proposal':'estimate';}
   else{const b=await sb.from('client_billing_documents').select('client_id').eq('id',target.id).single();if(b.error)throw b.error;client=b.data.client_id;}
   if(!client)throw new Error('Client unavailable');const contacts=await clientRecipients(sb,client,site,purpose,'email');const contact=contacts.find(c=>c.id===data.contactId);if(!contact?.email)throw new Error('Choose an authorised document contact');
   if(target.type==='quote'){const link=await sb.rpc('customer_quote_action',{_id:target.id,_action:'link',_data:{approval:false}});if(link.error)throw link.error;const token=(link.data as {token?:string})?.token;if(!token)throw new Error('Link unavailable');url=`https://fieldbridgeapp.com/quote/${token}`;}
   else{const link=await sb.rpc('create_client_billing_link',{_id:target.id});if(link.error)throw link.error;url=`https://fieldbridgeapp.com/billing-document/${link.data}`;}
   // Re-read payment/decision immediately before calling the fixed reminder template.
   const fresh=await workspace(sb);if(!fresh.targets.some(t=>t.id===target.id&&targetOpen(t)))throw new Error('Document no longer needs a reminder');
   const {sendTemplateEmail}=await import('./email-templates/send-email');const {resolveEmailIdentity}=await import('./email-identity.server');
   const result=await sendTemplateEmail('client-followup',contact.email,{identity:await resolveEmailIdentity(sb,company),idempotencyKey:`client-followup-${target.id}-${stage.key}`,templateData:{company:(await sb.from('companies').select('name').eq('id',company).single()).data?.name??'FieldBridge',name:contact.first_name,reference:target.reference,message:w.rules[target.type].message,amount:target.type==='quote'?'':new Intl.NumberFormat('en-GB',{style:'currency',currency:target.currency}).format(target.balance),due:target.due,documentUrl:url}});
   outcome=result.sent?'sent':result.reason;
  }
  patch={completed_stages:[...new Set([...row.data.completed_stages,stage.key])]};
 }
 patch.activity=[...activity,{at:new Date().toISOString(),action:outcome,stage:data.stage??null,actor:context.userId}].slice(-100) as Json;
 const saved=await sb.from('finance_followups').update(patch).eq('id',row.data.id);if(saved.error)throw new Error('Action processed but history could not be saved. Retry safely.');return {outcome};
});
export const getFinanceContacts=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({target:z.string().uuid()}).parse(input)).handler(async({data,context})=>{await office(context.supabase);const sb=context.supabase;const b=await sb.from('client_billing_documents').select('client_id').eq('id',data.target).maybeSingle();if(b.data?.client_id)return clientRecipients(sb,b.data.client_id,null,'invoice','email');const q=await sb.from('customer_quotes').select('client_id,site_id,snapshot').eq('id',data.target).single();if(q.error||!q.data.client_id)throw new Error('Document unavailable');const snap=q.data.snapshot as unknown as QuoteSnapshot;return clientRecipients(sb,q.data.client_id,q.data.site_id,snap.document.kind==='proposal'?'proposal':'estimate','email');});