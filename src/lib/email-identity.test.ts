import { describe, expect, it } from 'vitest';
import { emailIdentity } from './email-identity';
describe('Tenant email identity', () => {
  it('forces FieldBridge even for an Enterprise trial company when HQ disables branding', () => {
    expect(emailIdentity('MINAKEL', 'sales@minakel.com', false)).toEqual({ name: 'FieldBridge' });
  });
  it('uses tenant name and sales reply address when branding is allowed', () => {
    expect(emailIdentity('MINAKEL', 'sales@minakel.com', true)).toEqual({ name: 'MINAKEL', replyTo: 'sales@minakel.com' });
  });
  it('never accepts injected or multiple reply addresses', () => {
    expect(emailIdentity('MINAKEL', 'sales@minakel.com\r\nBcc: other@example.com', true)).not.toHaveProperty('replyTo');
    expect(emailIdentity('MINAKEL', 'sales@minakel.com,other@example.com', true)).not.toHaveProperty('replyTo');
  });
});