import * as React from 'react'
import { Img, Section, Text } from '@react-email/components'

// Email clients cannot resolve the app's CSS variables; keep approved brand
// values here so every authentication template shares the same palette.
export const emailBrand = {
  navy: '#1B2A4A',
  amber: '#F2A104',
  paper: '#ffffff',
  text: '#39465b',
  muted: '#647084',
}
export const main = { backgroundColor: emailBrand.paper, fontFamily: 'Arial, sans-serif' }
export const container = { padding: '32px 24px', maxWidth: '520px', margin: '0 auto' }
export const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: emailBrand.navy, margin: '0 0 20px' }
export const text = { fontSize: '15px', color: emailBrand.text, lineHeight: '1.6', margin: '0 0 24px' }
export const link = { color: emailBrand.navy, textDecoration: 'underline' }
export const button = { backgroundColor: emailBrand.navy, color: emailBrand.paper, fontSize: '15px', fontWeight: 'bold' as const, border: `1px solid ${emailBrand.navy}`, borderRadius: '6px', padding: '14px 24px', textDecoration: 'none' }
export const footer = { fontSize: '12px', color: emailBrand.muted, lineHeight: '1.6', margin: '30px 0 0' }
export const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: emailBrand.navy, backgroundColor: emailBrand.paper, borderLeft: `4px solid ${emailBrand.amber}`, padding: '12px 20px', margin: '0 0 30px' }

export function AuthBrandHeader() {
  return <Section style={{ borderBottom: `3px solid ${emailBrand.amber}`, paddingBottom: '20px', marginBottom: '28px' }}>
    <Img src="https://fieldbridgeapp.com/app-icon-192.png" width="48" height="48" alt="FieldBridge" />
    <Text style={{ color: emailBrand.navy, fontSize: '22px', fontWeight: 'bold', margin: '10px 0 0' }}>FieldBridge</Text>
  </Section>
}