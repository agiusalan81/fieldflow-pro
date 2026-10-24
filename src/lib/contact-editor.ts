import { preferencesFor, type RoutingContact } from './client-routing';

export const CONTACT_POSITIONS = ['Owner', 'Operations manager', 'Site manager', 'Site supervisor', 'Accounts', 'Other'] as const;
export function contactScopeMatches(contact: RoutingContact, siteId?: string | null) {
  if (siteId === undefined) return true;
  if (siteId === null) return contact.all_sites;
  return contact.all_sites || contact.site_ids.includes(siteId) || contact.site_id === siteId;
}
export function contactWrite(contact: RoutingContact) {
  const preferences = Object.fromEntries(Object.entries(preferencesFor(contact)).map(([key, value]) => [key, { email: !!value.email, whatsapp: contact.has_whatsapp && !!value.whatsapp }]));
  return {
    first_name: contact.first_name.trim(), last_name: contact.last_name?.trim() || null,
    email: contact.email?.trim().toLowerCase() || null, phone: contact.phone?.trim() || null,
    role_title: contact.role_title?.trim() || null, is_primary_contact: !!contact.is_primary_contact,
    all_sites: contact.all_sites, site_ids: contact.all_sites ? [] : [...new Set(contact.site_ids)],
    site_id: contact.all_sites ? null : contact.site_ids[0] ?? null,
    has_whatsapp: contact.has_whatsapp, delivery_preferences: preferences,
    receives_job_sheets: !!preferences['job_sheet']?.email,
  };
}