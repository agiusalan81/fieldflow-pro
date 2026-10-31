import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';

type Props = { company?: string; product?: string; name?: string; role?: string; inviteUrl?: string; expires?: string };
function TeamInvite({ company = 'Your company', product = 'FieldBridge', name = '', role = 'team member', inviteUrl = '', expires = '' }: Props) {
  return <Html lang="en"><Head /><Preview>{company} invited you to join {product}</Preview><Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}><Container style={{ maxWidth: '560px', padding: '24px' }}>
    <Heading>{company} · {product}</Heading><Text>Hello {name || 'there'},</Text><Text>{company} has invited you to their team as {role}. Join with Google, Microsoft or email sign-in.</Text>
    {inviteUrl && <Button href={inviteUrl} style={{ backgroundColor: '#14213d', color: '#ffffff', padding: '12px 20px', borderRadius: '6px' }}>Accept invitation &amp; join</Button>}
    <Text>This invitation works once{expires ? ` and expires on ${expires}` : ''}.</Text><Text>If you were not expecting this invitation, you can ignore it.</Text>
  </Container></Body></Html>;
}
export const template = { component: TeamInvite, subject: d => `${d['company'] || 'Your company'} invited you to join ${d['product'] || 'FieldBridge'}`, displayName: 'Team invitation', previewData: { company: 'Example company', product: 'FieldBridge Hotels', name: 'Maria', role: 'Office Admin' } } satisfies TemplateEntry;