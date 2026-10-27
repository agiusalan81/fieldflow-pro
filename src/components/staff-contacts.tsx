import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, Link as LinkIcon, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlanFeatures } from '@/lib/plan-features';
import { useClientPortalAccess } from '@/lib/client-portal-access';
import { sendPortalInvite } from '@/lib/portal-invite.functions';
import { DELIVERY_PURPOSES, PORTAL_URL, preferencesFor, recipientPreview, type RoutingContact, type DeliveryPurpose } from '@/lib/client-routing';
import { CONTACT_POSITIONS, contactScopeMatches, contactWrite } from '@/lib/contact-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import { formatSiteDisplay, formatSiteTitle } from '@/lib/site-display';

export function StaffContacts({ clientId, companyId, siteId, title = 'Contact persons' }: { clientId: string; companyId: string; siteId?: string | null; title?: string }) {
  const qc = useQueryClient();
  const management = usePlanFeatures()('client_management');
  const portal = useClientPortalAccess();
  const contactsQuery = useQuery({ queryKey: ['client-contacts', clientId], queryFn: async () => {
    const r = await supabase.from('client_contacts').select('*').eq('client_id', clientId).order('is_primary_contact', { ascending: false });
    if (r.error) throw r.error;
    return r.data as RoutingContact[];
  } });
  const { data: sites = [] } = useQuery({ queryKey: ['client-sites', clientId], queryFn: async () => {
    const r = await supabase.from('sites').select('*').eq('client_id', clientId).order('name');
    if (r.error) throw r.error;
    return r.data;
  } });
  const [edit, setEdit] = useState<RoutingContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewSite, setPreviewSite] = useState(siteId ?? '');
  const [purpose, setPurpose] = useState<DeliveryPurpose>('job_sheet');
  const all = contactsQuery.data ?? [];
  const contacts = all.filter(c => contactScopeMatches(c, siteId));
  const refresh = () => Promise.all(['client-contacts', 'client-workspace', 'contacts', 'entities-unified'].map(key => qc.invalidateQueries({ queryKey: key === 'client-contacts' || key === 'client-workspace' ? [key, clientId] : [key] })));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!edit || busy) return;
    setBusy(true);
    try {
      const row = contactWrite(edit);
      const r = edit.id ? await supabase.from('client_contacts').update(row).eq('id', edit.id).select('id').single() : await supabase.from('client_contacts').insert({ ...row, client_id: clientId, company_id: companyId }).select('id').single();
      if (r.error) throw r.error;
      await refresh(); setEdit(null); toast.success('Contact and delivery preferences saved');
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'Contact could not be saved'); }
    finally { setBusy(false); }
  };
  const invite = async (c: RoutingContact) => {
    if (!portal.allowed) return;
    try { const r = await sendPortalInvite({ data: { clientId, contactId: c.id, admin: !!c.is_primary_contact } }); toast.success(r.sent ? `Invitation emailed to ${r.email}` : 'This address has opted out of emails — invitation not sent'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Invitation could not be sent'); }
  };
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{title}</h3>{!edit && (management || all.length === 0) && <Button size="sm" variant="outline" onClick={() => setEdit({ id: '', first_name: '', last_name: '', email: '', phone: '', role_title: 'Operations manager', site_id: siteId ?? null, site_ids: siteId ? [siteId] : [], all_sites: !siteId, has_whatsapp: false, receives_job_sheets: false, is_primary_contact: all.length === 0, delivery_preferences: {} })}><Plus className="mr-1 h-4 w-4"/>Add contact</Button>}</div>
    {contactsQuery.error && <p role="alert" className="text-destructive">Contacts could not be loaded. Please retry.</p>}
    {contactsQuery.isPending && <p role="status">Loading contacts…</p>}
    {edit && <form onSubmit={save} className="space-y-3 border-y py-3">
      <div className="grid gap-3 sm:grid-cols-2">{(['first_name', 'last_name', 'email', 'phone'] as const).map(key => <div key={key}><Label htmlFor={`staff-${key}-${siteId ?? 'all'}`}>{({ first_name: 'First name', last_name: 'Surname', email: 'Email', phone: 'Phone' })[key]}</Label><Input id={`staff-${key}-${siteId ?? 'all'}`} required={key === 'first_name' || key === 'email'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={edit[key] ?? ''} onChange={e => setEdit({ ...edit, [key]: e.target.value })}/></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><div><Label>Position</Label><NativeSelect aria-label="Contact position" value={CONTACT_POSITIONS.some(p => p === edit.role_title) ? edit.role_title ?? 'Other' : 'Other'} onValueChange={value => setEdit({ ...edit, role_title: value })}>{CONTACT_POSITIONS.map(p => <option key={p}>{p}</option>)}</NativeSelect>{(!CONTACT_POSITIONS.some(p => p === edit.role_title) || edit.role_title === 'Other') && <Input aria-label="Other position" value={edit.role_title === 'Other' ? '' : edit.role_title ?? ''} onChange={e => setEdit({ ...edit, role_title: e.target.value })}/>}</div>
      <div><Label>Site scope</Label><NativeSelect aria-label="Contact site scope" disabled={!management} value={edit.all_sites ? 'all' : 'selected'} onValueChange={value => setEdit({ ...edit, all_sites: value === 'all' })}><option value="all">All sites / client-wide</option><option value="selected">Selected sites</option></NativeSelect></div></div>
      {!edit.all_sites && <fieldset className="space-y-2"><legend className="text-sm font-medium">Assigned sites / Location</legend>{sites.map(s => <label key={s.id} className="flex items-center gap-2 text-sm"><Checkbox disabled={!management} checked={edit.site_ids.includes(s.id)} onCheckedChange={v => setEdit({ ...edit, site_ids: v ? [...edit.site_ids, s.id] : edit.site_ids.filter(id => id !== s.id) })}/>{formatSiteDisplay(s)}</label>)}</fieldset>}
      <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><Checkbox checked={!!edit.is_primary_contact} onCheckedChange={v => setEdit({ ...edit, is_primary_contact: v === true })}/>Primary contact</label><label className="flex items-center gap-2"><Checkbox checked={edit.has_whatsapp} onCheckedChange={v => setEdit({ ...edit, has_whatsapp: v === true })}/>Available on WhatsApp</label></div>
      <table className="w-full text-sm"><thead><tr><th className="py-2 text-left">Document / event</th><th>Email</th><th>WhatsApp</th></tr></thead><tbody>{DELIVERY_PURPOSES.map(p => <tr key={p.key} className="border-t"><td className="py-2">{p.label}</td>{(['email', 'whatsapp'] as const).map(channel => <td key={channel} className="text-center"><Checkbox aria-label={`${p.label} ${channel}`} disabled={channel === 'whatsapp' && !edit.has_whatsapp} checked={channel === 'whatsapp' ? edit.has_whatsapp && !!preferencesFor(edit)[p.key]?.whatsapp : !!preferencesFor(edit)[p.key]?.email} onCheckedChange={v => setEdit({ ...edit, delivery_preferences: { ...preferencesFor(edit), [p.key]: { email: false, whatsapp: false, ...preferencesFor(edit)[p.key], [channel]: v === true } } })}/></td>)}</tr>)}</tbody></table>
      <div className="flex gap-2"><Button disabled={busy} type="submit" size="sm"><Save className="mr-1 h-4 w-4"/>{busy ? 'Saving…' : 'Save contact'}</Button><Button disabled={busy} type="button" variant="ghost" size="sm" onClick={() => setEdit(null)}>Cancel</Button></div>
    </form>}
    {!!contacts.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Contact person</th><th className="p-2">Position</th><th className="p-2">Email / phone</th><th className="p-2">Sites / Location</th><th className="p-2">Actions</th></tr></thead><tbody>{contacts.map(c => <tr key={c.id} className="border-b"><td className="p-2">{c.first_name} {c.last_name}{c.is_primary_contact && <span className="block text-xs text-primary">Primary</span>}</td><td className="p-2">{c.role_title || '—'}</td><td className="p-2"><span className="block">{c.email}</span><span className="block whitespace-nowrap text-muted-foreground">{c.phone}{c.has_whatsapp ? ' · WhatsApp' : ''}</span></td><td className="p-2">{c.all_sites ? <span className="rounded-full border px-2 py-0.5 text-xs">All sites · Client-wide</span> : c.site_ids.length ? c.site_ids.map(id => { const site = sites.find(s => s.id === id); return <span key={id} className="mb-1 block"><span className="block font-medium">{site ? formatSiteTitle(site) : 'Assigned site'}</span>{site?.address && <span className="block text-xs text-muted-foreground">{site.address}</span>}</span>; }) : 'No assigned sites'}</td><td className="p-2"><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Edit ${c.first_name}`} onClick={() => setEdit({ ...c, delivery_preferences: preferencesFor(c) })}><Pencil className="h-4 w-4"/></Button><Button size="icon" variant="ghost" aria-label={`Delete ${c.first_name}`} onClick={async () => { if (!confirm('Delete this contact?')) return; const r = await supabase.from('client_contacts').delete().eq('id', c.id); if (r.error) toast.error(r.error.message); else await refresh(); }}><Trash2 className="h-4 w-4"/></Button>{portal.allowed && <Button size="sm" variant="outline" aria-label={`Invite ${c.first_name} to client portal`} onClick={() => void invite(c)}><LinkIcon className="mr-1 h-4 w-4"/>Invite to portal</Button>}</div></td></tr>)}</tbody></table></div>}
    {!!all.length && management && <div className="space-y-2 border-t pt-3"><h4 className="text-sm font-medium">Recipient preview</h4><div className="grid gap-2 sm:grid-cols-2"><NativeSelect aria-label="Recipient preview site" value={previewSite} onValueChange={setPreviewSite}><option value="">Client-wide</option>{sites.map(s => <option key={s.id} value={s.id}>{formatSiteDisplay(s)}</option>)}</NativeSelect><NativeSelect aria-label="Recipient preview document" value={purpose} onValueChange={v => setPurpose(v as DeliveryPurpose)}>{DELIVERY_PURPOSES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</NativeSelect></div>{(['email', 'whatsapp'] as const).map(channel => <p key={channel} className="text-sm"><span className="font-medium">{channel === 'email' ? 'Email' : 'WhatsApp'}: </span>{recipientPreview(all, previewSite || null, purpose, channel).map(c => `${c.first_name} ${c.last_name ?? ''}`).join(', ') || 'No selected recipients'}</p>)}</div>}
  </section>;
}