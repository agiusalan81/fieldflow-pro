export type EmailIdentity = { name: string; replyTo?: string };
export function emailIdentity(company: string | null | undefined, email: string | null | undefined, allowed: boolean): EmailIdentity {
  if (!allowed) return { name: 'FieldBridge' };
  const name = company?.replace(/[\r\n\x00-\x1f]/g, '').trim().slice(0, 160) || 'FieldBridge';
  const reply = email?.trim();
  return { name, ...(reply && /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(reply) ? { replyTo: reply } : {}) };
}