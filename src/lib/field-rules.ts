import type { Kin } from "@/lib/profile";

export type AppRole = "superuser" | "admin" | "supervisor" | "technician" | "maintenance";

/** Supervisors decide technician leave only; supervisor/admin leave goes to an Office Admin or Superuser. Nobody but a superuser decides their own. */
export function canDecideLeave(approver: AppRole, applicant: AppRole, own: boolean) {
  if (own) return approver === "superuser";
  if (approver === "admin" || approver === "superuser") return true;
  return approver === "supervisor" && applicant === "technician";
}

/** Required personal details every member must complete before using the app. */
export function missingProfileFields(p: { phone_number: string | null; home_address: string | null; next_of_kin_1: Kin | null }) {
  const out: string[] = [];
  const phoneOk = (s?: string | null) => (s ?? "").replace(/\D/g, "").length >= 7;
  if (!phoneOk(p.phone_number)) out.push("Mobile phone");
  if (!(p.home_address ?? "").trim()) out.push("Home address");
  const k = p.next_of_kin_1 ?? {};
  if (!(k.name ?? "").trim()) out.push("Next of kin name");
  if (!(k.relationship ?? "").trim()) out.push("Next of kin relationship");
  if (!phoneOk(k.phone)) out.push("Next of kin phone");
  return out;
}

/** Today's assigned jobs whose job sheet is not completed. */
export function unfinishedJobs<J extends { id: string }>(jobs: J[], sheets: { job_id: string | null; status: string }[]) {
  return jobs.filter((j) => !sheets.some((s) => s.job_id === j.id && s.status === "completed"));
}

export const nextDay = (ymd: string) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
