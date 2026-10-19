/** Rules for client notices sent from the field: "no one to open" and "client left before signing". */
export type NoticeEvent = "no_access" | "unsigned_left" | "on_my_way";
export type DepartureStatus = "none" | "requested" | "approved" | "rejected";

/** Technicians may only ask; supervisors/office admins decide. */
export function canSetDeparture(from: DepartureStatus, to: DepartureStatus, manager: boolean): boolean {
  if (to === "requested") return from === "none" || from === "rejected";
  if (to === "approved" || to === "rejected") return manager && from === "requested";
  return false;
}

/** The unsigned-site notice goes to the client only after a manager approved the departure. */
export function canSendNotice(event: NoticeEvent, sheet: { departure_status: string; signature_data?: string | null }): string | null {
  if (event === "unsigned_left") {
    if (sheet.signature_data) return "This job sheet is already signed.";
    if (sheet.departure_status !== "approved") return "A supervisor or office admin must approve leaving the site first.";
  }
  return null;
}

/** WhatsApp numbers stored as +356 9943 5435 → 35699435435 for the API. */
export const waNumber = (phone: string | null | undefined) => (phone ?? "").replace(/[^\d]/g, "");
