import type { Role } from "./profile";
export type GuideStep = { to: string; title: string; detail: string };
export const guideKey = (userId: string, companyId: string) => `fieldflow:welcome:v1:${companyId}:${userId}`;
export function guideSteps(role: Role): GuideStep[] {
  const personal = [{to:"/hours",title:"Your hours",detail:"Review recorded hours and overtime."}, {to:"/leave",title:"Your leave",detail:"Review your balance and request time off."}, {to:"/settings",title:"Your details",detail:"Check your contact details and next of kin."}];
  if (role === "technician" || role === 'maintenance') return [{to:"/dashboard",title:"Your working day",detail:"Review today's visits and clock in when your shift starts."},{to:"/sheets",title:"Your job sheets",detail:"Open assigned work, record repairs and prepare the client sign-off."}, ...personal];
  const shared = [{to:"/dashboard",title:"Your overview",detail:"Review work, alerts and today's priorities."},{to:"/team",title:"Your team",detail:"Check live availability, review the roster and invite new colleagues."},{to:"/admin/jobs",title:"Company job sheets",detail:"Review job sheets and schedule visits."}];
  if (role === "supervisor") return [...shared, {to:"/standby",title:"Standby",detail:"Review the rota and shift swaps."}, ...personal];
  return [...shared,{to:"/contracts",title:"Client agreements",detail:"Review contracts, tiers and maintenance checklists."},{to:"/payroll/wages",title:"Employee wages",detail:"Review employee setup before generating payslips."}, ...(role === "superuser" ? [{to:"/company",title:"Company settings",detail:"Review branding, working hours and documents."}] : []), ...personal];
}