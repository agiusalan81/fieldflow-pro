export type InspectionStatus = "overdue" | "due_soon" | "ok" | "unscheduled";

/** Due status for a statutory inspection: overdue after the due date, due soon within 30 days. */
export function inspectionStatus(nextDue: string | null | undefined, today = new Date()): InspectionStatus {
  if (!nextDue) return "unscheduled";
  const due = new Date(`${nextDue}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  return days < 0 ? "overdue" : days <= 30 ? "due_soon" : "ok";
}

export const INSPECTION_TYPES = ["periodic", "initial", "after_modification", "after_accident", "insurance"] as const;
export const inspectionTypeLabel = (t: string) => ({ periodic: "Periodic statutory", initial: "Initial / commissioning", after_modification: "After modification", after_accident: "After accident", insurance: "Insurance" } as Record<string, string>)[t] ?? t;
