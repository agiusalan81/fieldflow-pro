export const TRUST_PAGES = {
  privacy: {
    title: "Privacy policy", description: "How FieldBridge handles account information, company records and privacy requests.",
    sections: [
      ["Who handles your information", "FieldBridge provides company workspaces for field service teams. Your employer or service contractor decides why work records and employee information are collected. FieldBridge processes those records to provide the service; account administration and service security are separate platform purposes."],
      ["Information used by the service", "Depending on the modules your company enables, records may include account and contact details, job sheets, equipment records, photographs, signatures, team messages, time logs and payroll or leave information. Financial and sensitive employee records have restricted access. Do not upload information you are not authorised to share."],
      ["Location and device permissions", "Location sharing requires consent and is limited to active shifts where enabled. Authorised company managers can view shared locations. Camera, microphone and notification permissions are requested for relevant actions and can be controlled in your device settings."],
      ["Usage reporting", "HQ usage reporting uses coarse company-level feature counts, subscription activity and lifetime totals. It is not intended to collect client details, message content, signatures, raw GPS traces, payroll figures or sick-leave content as analytics."],
      ["Storage and service providers", "Records and attachments are held in private cloud services with company-scoped access controls. Authentication, email delivery and payment providers may process information necessary for their functions. Payment card handling is delegated to the payment provider; FieldBridge does not require card details in job sheets or chat."],
      ["Retention and your rights", "Retention depends on your company's contractual, legal and operational requirements; deleting a member does not necessarily remove historical work evidence. Ask your company administrator about access, corrections, exports or deletion of work records. For platform-account privacy requests, use the privacy contact below. Applicable law may also give you the right to complain to a data protection authority."],
      ["Cookies and local storage", "FieldBridge uses authentication and local device storage to keep sessions, preferences and offline work available. The public site does not currently add optional advertising or third-party analytics tracking. There is no optional tracking consent switch to enable. Future optional tracking must be reviewed before it is introduced."],
    ],
  },
  terms: {
    title: "Terms of service", description: "FieldBridge account responsibilities, subscription terms and permitted use.",
    sections: [
      ["Using FieldBridge", "FieldBridge is a business service for authorised company teams. You must provide accurate account details, have authority to create or join a company workspace and protect your sign-in credentials. Your company is responsible for invitations, role assignments and the accuracy of its records."],
      ["Trials and subscriptions", "The current standard trial is 60 days with no upfront card. Available plans, modules, storage and billing periods are shown in the published catalogue and your subscription offer. Prices are exclusive of VAT unless stated otherwise. Your accepted invoice and subscription record determine the commercial terms that apply to your company."],
      ["Renewals and account access", "Renewal invoices and payment status govern subscription access. Read-only restrictions may apply when a trial expires or an invoice lapses. Retained records remain subject to access permissions. Contact the platform before a renewal to discuss cancellation or plan changes; do not assume an email or saved request has automatically cancelled a subscription."],
      ["Your records and responsibilities", "Your company remains responsible for its uploaded records, legal notices, client permissions, employee information and signed documents. Only upload material you are entitled to use. Do not use FieldBridge for unlawful activity, unauthorised access or harmful files."],
      ["Technical work and compliance", "FieldBridge supports record keeping and workflows; it does not replace competent engineering judgement, safety inspections, employment advice or statutory checks. Review generated documents, payroll calculations and reports before relying on them."],
      ["Availability and ending service", "No uninterrupted availability guarantee is made on this page. Any service levels, liability provisions, refund arrangements and governing law must be agreed in your signed commercial terms. Export required records before ending service and contact the platform to agree applicable retention and deletion arrangements."],
    ],
  },
  security: {
    title: "Security", description: "Company isolation, role-based access and protected records in FieldBridge.",
    sections: [
      ["Company isolation", "Company records are scoped through database access policies, not just hidden screen controls. Protected roles govern access to sensitive functions. Platform HQ authority is separate from ordinary company membership."],
      ["Attachments and client sharing", "Chat files, technical documents, receipts and job photos use private storage and authorised access. Client reports expose a limited client-safe snapshot through expiring or revocable links. Public equipment QR reports expose equipment identification rather than private technical records."],
      ["Financial and signed evidence", "Issued platform invoices and payslips have immutability controls. Signed or shared work evidence can restrict deletion. Payment confirmation is verified server-side rather than accepted from a browser redirect alone."],
      ["Your part in security", "Keep accounts individual, review member access when staff leave, lock your devices and report suspicious sign-in or unexpected access promptly. Offline records may remain on a device until synchronised or deliberately discarded; use trusted devices."],
      ["Reporting a concern", "Contact the platform using the contact details below. Include a description and affected page, but do not send passwords, payment card details or unnecessary personal records. This page does not claim certification, an independent audit or a guaranteed incident response time."],
    ],
  },
  accessibility: {
    title: "Accessibility", description: "FieldBridge accessibility approach and how to report barriers.",
    sections: [
      ["Our approach", "We aim to make FieldBridge usable with clear labels, keyboard-operable controls, visible focus states and layouts that adapt to screen size. Accessibility is ongoing work; this statement is not a claim of certified conformance."],
      ["Known limitations", "Drawing signatures, camera scans, maps and some document previews may require pointer input or visual interpretation. Generated PDFs and tenant-customised colours or layouts may not meet every accessibility requirement. An independent full accessibility audit has not yet been completed."],
      ["Alternatives and feedback", "If a task is inaccessible, contact your company administrator or the platform contact below to request assistance or an alternative format. Include the page, device, assistive technology and what prevented completion, without sharing unnecessary personal information."],
    ],
  },
} as const;
export type TrustPageKey = keyof typeof TRUST_PAGES;
export const TRUST_LINKS = [ ["/privacy", "Privacy"], ["/terms", "Terms"], ["/security", "Security"], ["/accessibility", "Accessibility"] ] as const;
export function trustHead(key: TrustPageKey) {
  const page = TRUST_PAGES[key]; const title = `${page.title} — FieldBridge`; const url = `https://fieldbridgeapp.com/${key}`;
  return { meta: [{ title }, { name: "description", content: page.description }, { property: "og:title", content: title }, { property: "og:description", content: page.description }, { property: "og:type", content: "website" }, { property: "og:url", content: url }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: url }] };
}