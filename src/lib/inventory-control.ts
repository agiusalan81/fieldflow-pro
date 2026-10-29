/** Inventory & tool governance rules. Mirrors tool_sign_out / tool_sign_in / guard_inventory_stock in the database. */
export type ControlMode = "managed" | "self_service";
export type ToolStatus = "available" | "checked_out" | "in_maintenance" | "decommissioned";

const MANAGERS = ["superuser", "admin", "supervisor"];
export const isInventoryManager = (role?: string | null) => !!role && MANAGERS.includes(role);

/** Can `role` sign this tool out to `holderId`? */
export function canSignOut(role: string | null | undefined, mode: ControlMode, actorId: string, holderId: string) {
  if (isInventoryManager(role)) return true;
  return mode === "self_service" && actorId === holderId;
}

/** Can `role` sign this tool back in? */
export function canSignIn(role: string | null | undefined, mode: ControlMode, actorId: string, currentHolder: string | null) {
  if (isInventoryManager(role)) return true;
  return mode === "self_service" && !!currentHolder && actorId === currentHolder;
}

/** Can `role` change stock quantities of a part? */
export function canAdjustStock(role: string | null | undefined, mode: ControlMode, requiresApproval: boolean) {
  if (isInventoryManager(role)) return true;
  return mode === "self_service" && !requiresApproval;
}

export const statusAfterReturn = (condition: "good" | "needs_maintenance"): ToolStatus => condition === "good" ? "available" : "in_maintenance";

export function isOverdue(expected: string | null | undefined, today = new Date().toISOString().slice(0, 10)) {
  return !!expected && expected < today;
}

export const TOOL_CATEGORIES = ["Cutting & drilling", "Lifting & rigging", "Diagnostic & electrical", "Power tools", "Safety & PPE", "Hand tools", "General"];
export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = { available: "In store", checked_out: "Signed out", in_maintenance: "Out for repair", decommissioned: "Retired" };
