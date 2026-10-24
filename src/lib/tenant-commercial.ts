import { z } from 'zod';
export type CommercialStatus = { state?: string; subscription_status?: string; plan_id?: string | null; pack_ids?: string[]; cadence?: string; seats?: number; agreed_price?: number; trial_package_only?: boolean; trial_ends_at?: string; pending_change?: unknown; modules?: { name: string; enabled: boolean }[] };
export type CommercialItem = { id: string; kind: string; modules: string[] };
export function itemAccess(item: CommercialItem, status: CommercialStatus): { label: string; assigned: boolean; available: boolean } {
  const assigned = item.kind === 'plan' ? item.id === status.plan_id : !!status.pack_ids?.includes(item.id);
  const available = status.state === 'legacy' || (item.modules.length > 0 && item.modules.every(m => m === 'core' || status.modules?.some(x => x.name === m && x.enabled)));
  if (status.state === 'legacy') return { label: assigned ? 'Assigned · legacy' : 'Legacy access', assigned, available };
  if (status.state === 'trial') return { label: assigned ? 'Activated · trial' : available ? 'Included in trial access' : 'Available', assigned, available };
  if (assigned) return { label: status.state === 'active' ? 'Subscribed' : 'Assigned · access paused', assigned, available };
  return { label: available ? 'Included in current access' : 'Available', assigned, available };
}
export const REQUEST_CATEGORIES = { estimate_template: 'Estimate template', proposal_template: 'Proposal template', job_sheet_template: 'Job sheet template', checklist: 'Checklist & safety', integration: 'Workflow integration', custom_module: 'Custom module', plan_change: 'Plan or add-on activation', storage_change: 'Storage change' } as const;
export const REQUEST_STATUSES = { draft: 'Draft', submitted: 'Submitted', in_review: 'Under review', quoted: 'Quote available', in_progress: 'In progress', delivered: 'Delivered', declined: 'Declined' } as const;
export const customRequestSchema = z.object({ title: z.string().trim().min(1).max(160), category: z.enum(['estimate_template','proposal_template','job_sheet_template','checklist','integration','custom_module','plan_change','storage_change']), notes: z.string().max(10000), target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });
export const SAMPLE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp';
export function validSample(file: { name: string; size: number }) { return /\.(pdf|docx?|xlsx?|csv|jpe?g|png|webp)$/i.test(file.name) && file.size > 0 && file.size <= 10 * 1024 * 1024; }