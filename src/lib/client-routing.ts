export const DELIVERY_PURPOSES = [{key:'job_sheet',label:'Job sheets'},{key:'eta',label:'On-my-way ETA'},{key:'estimate',label:'Estimates'},{key:'proposal',label:'Proposals'},{key:'contract',label:'Contracts'},{key:'invoice',label:'Invoices'},{key:'no_access',label:'No access'},{key:'unsigned_left',label:'Unsigned departure'}] as const;
export type DeliveryPurpose = typeof DELIVERY_PURPOSES[number]['key'];
export type DeliveryPreferences = Partial<Record<DeliveryPurpose,{email:boolean;whatsapp:boolean}>>;
export type RoutingContact = {id:string;first_name:string;last_name:string|null;email:string|null;phone:string|null;role_title:string|null;site_id:string|null;site_ids:string[];all_sites:boolean;delivery_preferences:DeliveryPreferences|null;has_whatsapp:boolean;receives_job_sheets:boolean;is_primary_contact?:boolean;can_approve_quotes?:boolean};
export type ClientWorkspace = {id:string;name:string;company_id:string;module_on:boolean;scope:{office:boolean;admin:boolean;all_sites:boolean;site_ids:string[];contact?:string;can_approve?:boolean};sites:{id:string;name:string;address:string|null;store_code?:string|null}[];contacts:RoutingContact[];sheets:{id:string;jobsheet_number:string;created_at:string;site_id:string|null;reported_fault:string|null;repairs_performed:string|null;maintenance_notes?:string|null}[];quotes?:PortalQuote[];assets?:PortalAsset[]};
export type PortalQuote={id:string;reference:string;revision:number;status:'sent'|'awaiting_confirmation'|'accepted'|'declined';site_id:string|null;issued_at:string|null;decided_at:string|null;signer_name:string|null;office_recorded?:{name:string;evidence:string;at:string}|null;snapshot:import('./customer-quotes').QuoteSnapshot};
export type PortalAsset={id:string;reference:string;category:string|null;location:string|null;site_id:string|null};
/** Quotes still needing the client's own decision: issued, or accepted by phone/verbally via the office. */
export const quoteNeedsClient=(s:string)=>s==='sent'||s==='awaiting_confirmation';
/** Portal contacts may decide a quote only when open, unexpired, and they hold approval rights. */
export function canDecidePortalQuote(q:Pick<PortalQuote,'status'>&{snapshot:{document:{valid_until:string}}},canApprove:boolean,today=new Date().toISOString().slice(0,10)){return canApprove&&quoteNeedsClient(q.status)&&q.snapshot.document.valid_until>=today;}
export const PORTAL_URL='https://fieldbridgeapp.com/client-portal';
export function preferencesFor(c: RoutingContact): DeliveryPreferences {
  if(c.delivery_preferences)return c.delivery_preferences;
  return Object.fromEntries(DELIVERY_PURPOSES.map(p=>[p.key,{email:c.receives_job_sheets||(p.key!=='job_sheet'&&!!c.is_primary_contact),whatsapp:c.has_whatsapp}]));
}
export function recipientPreview(contacts: RoutingContact[],site:string|null,purpose:DeliveryPurpose,channel:'email'|'whatsapp') {
  const seen=new Set<string>();
  return contacts.filter(c=>{const scoped=c.delivery_preferences?(c.all_sites||!!site&&c.site_ids.includes(site)):(c.site_id===null||c.site_id===site);const pref=preferencesFor(c)[purpose];const target=channel==='email'?c.email?.trim().toLowerCase():c.phone?.replace(/\D/g,'');if(!scoped||!pref?.[channel]||!target||channel==='whatsapp'&&!c.has_whatsapp||seen.has(target))return false;seen.add(target);return true;});
}
export function presetPreferences(preset:'operations'|'site'|'owner'):DeliveryPreferences {
  return Object.fromEntries(DELIVERY_PURPOSES.map(p=>[p.key,{email:preset==='operations'||preset==='site'&&['job_sheet','no_access','unsigned_left'].includes(p.key)||preset==='owner'&&['estimate','proposal','contract','invoice'].includes(p.key),whatsapp:preset==='operations'&&['eta','estimate'].includes(p.key)||preset==='site'&&p.key==='eta'}]));
}
/** A combined document can go only to destinations eligible for every included site's sheet. */
export function commonRecipients(groups:string[][]) { return groups.length?[...new Set(groups[0])].filter(email=>groups.every(group=>group.includes(email))):[]; }