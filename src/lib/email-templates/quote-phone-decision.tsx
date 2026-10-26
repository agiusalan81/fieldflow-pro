import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';
type Props = { company?: string; name?: string; title?: string; reference?: string; decision?: string; documentUrl?: string };
function QuotePhoneDecision({ company = '', name = '', title = '', reference = '', decision = 'accepted', documentUrl = '' }: Props) {
  const accepted = decision === 'accepted';
  return <Html><Head /><Preview>{company}: your decision on {reference}</Preview><Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}><Container style={{ maxWidth: '560px', padding: '24px' }}><Heading>{company}</Heading><Text>Hello {name},</Text>
    {accepted
      ? <Text>Thank you — we recorded by phone that you <strong>accepted</strong> quote <strong>{reference}</strong> ({title}). Please confirm in writing using the button below so we can schedule the work.</Text>
      : <Text>We recorded by phone that you <strong>declined</strong> quote <strong>{reference}</strong> ({title}). If this is not correct, please reply to this email.</Text>}
    {documentUrl && <Button href={documentUrl} style={{ backgroundColor: '#14213d', color: '#ffffff', padding: '12px 20px', borderRadius: '6px' }}>{accepted ? 'Review and confirm acceptance' : 'View quote'}</Button>}
  </Container></Body></Html>;
}
export const template = { component: QuotePhoneDecision, subject: d => `${d['company'] ?? ''} — Quote ${d['reference'] ?? ''} ${d['decision'] === 'accepted' ? 'acceptance to confirm' : 'declined'}`, displayName: 'Phone decision recorded', previewData: { company: 'Example company', name: 'Customer', title: 'Scheduled repair', reference: 'Q-1001', decision: 'accepted', documentUrl: 'https://fieldbridgeapp.com' } } satisfies TemplateEntry;
