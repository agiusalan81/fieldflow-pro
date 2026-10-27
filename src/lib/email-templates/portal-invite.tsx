import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';
type Props = { company?: string; name?: string; inviteUrl?: string; admin?: boolean };
function PortalInvite({ company = '', name = '', inviteUrl = '', admin = false }: Props) {
  return <Html><Head /><Preview>{company} invited you to their client portal</Preview><Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}><Container style={{ maxWidth: '560px', padding: '24px' }}><Heading>{company}</Heading><Text>Hello {name || 'there'},</Text>
    <Text>{company} has invited you to their client portal{admin ? ' as a client administrator' : ''}. There you can view your job sheets, quotes, documents and equipment, and report problems.</Text>
    {inviteUrl && <Button href={inviteUrl} style={{ backgroundColor: '#14213d', color: '#ffffff', padding: '12px 20px', borderRadius: '6px' }}>Accept invitation</Button>}
    <Text style={{ color: '#666666', fontSize: '12px' }}>This secure link is personal to you. If you were not expecting it, you can ignore this email.</Text>
  </Container></Body></Html>;
}
export const template = { component: PortalInvite, subject: d => `${d['company'] ?? ''} — your client portal invitation`, displayName: 'Client portal invitation', previewData: { company: 'Example company', name: 'Maria', inviteUrl: 'https://fieldbridgeapp.com/client-portal', admin: false } } satisfies TemplateEntry;
