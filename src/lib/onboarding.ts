import type { Role } from "./profile";
/** A tour step: the page to open, and optionally the on-screen element (data-tour id) to spotlight. */
export type GuideStep = { to: string; title: string; detail: string; target?: string };
export const guideKey = (userId: string, companyId: string) => `fieldflow:welcome:v2:${companyId}:${userId}`;

const personal: GuideStep[] = [
  { to: "/hours", title: "Your hours", detail: "Check your recorded hours and overtime here at any time." },
  { to: "/leave", title: "Your leave", detail: "See your balance and request time off. You'll get an alert when it's decided." },
  { to: "/settings", title: "Your details", detail: "Keep your phone, address and next of kin up to date." },
];

const tech: GuideStep[] = [
  { to: "/dashboard", target: "clock-in", title: "1. Clock in", detail: "Start every shift here. Pick your van and confirm location sharing — it only runs while you are clocked in." },
  { to: "/dashboard", target: "today-jobs", title: "2. Today's jobs", detail: "Your visits for today. Tap Start travel when you leave, then Arrived on site when you get there — travel and work hours stay separate." },
  { to: "/dashboard", target: "alerts", title: "3. Alerts", detail: "The bell shows anything waiting for you — new dispatches, swaps and replies. Tap an alert to jump straight to it." },
  { to: "/sheets", target: "new-sheet", title: "4. Job sheets", detail: "Open or create a sheet to record the work: checklist, parts, photos and receipts. Tap the microphone to dictate notes." },
  { to: "/sheets", title: "5. Sign-off", detail: "Finish with the client's signature (or mark client absent) and your own, then submit. Offline? Keep working — it syncs when signal returns." },
];

const officeCore: GuideStep[] = [
  { to: "/dashboard", target: "attention", title: "Today's attention", detail: "Everything waiting for action — callouts, approvals, unassigned visits. Tap a line to open it." },
  { to: "/dashboard", target: "alerts", title: "Alerts", detail: "The bell links straight to each request so you can approve or reply immediately." },
  { to: "/admin/jobs", target: "dispatch", title: "Dispatch work", detail: "Create a visit, pick the client and site, and assign a lead technician (plus an assistant if needed)." },
  { to: "/crm", target: "crm-new-lead", title: "CRM leads", detail: "Log every enquiry as a lead, schedule follow-ups and convert won work into an estimate or job." },
  { to: "/estimates", title: "Estimates", detail: "Build customer estimates, send them for approval and track who accepted." },
];

export function guideSteps(role: Role): GuideStep[] {
  if (role === "technician" || role === "maintenance") return [...tech, ...personal];
  if (role === "supervisor") return [
    ...officeCore.slice(0, 3),
    { to: "/team", title: "Your team", detail: "Live availability, roster and invite links for new colleagues." },
    { to: "/sheets", target: "team-sheets", title: "Team job sheets", detail: "Switch to All team sheets to review every technician's work, including past months." },
    { to: "/standby", title: "On-call rota", detail: "Review the rota and approve shift swaps." },
    ...officeCore.slice(3), ...personal,
  ];
  return [
    ...officeCore,
    { to: "/team", title: "Your team", detail: "Invite colleagues and manage roles and capabilities." },
    { to: "/contracts", title: "Client agreements", detail: "Contracts, tiers and maintenance checklists." },
    { to: "/payroll/wages", title: "Employee wages", detail: "Check employee setup before generating payslips." },
    ...(role === "superuser" ? [{ to: "/company", title: "Company settings", detail: "Branding, hours, documents — and CRM settings to choose who can do what in the pipeline." }] : []),
    ...personal,
  ];
}
