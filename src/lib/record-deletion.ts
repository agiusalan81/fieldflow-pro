import type { Role } from "./profile";

/** Presentation only; protected roles and tenant policies enforce the write. */
export const canDeleteSheet = (role?: Role) => role === "superuser" || role === "admin";
export const canDeleteVisit = (role?: Role) => role === "superuser" || role === "admin" || role === "supervisor";
export const RECORD_DELETE_REFRESH_KEYS = ["admin-jobs", "sheets", "schedule", "dispatched-visits", "jobs", "today-jobs", "overview", "attention", "attention-overview", "action-notifications", "bell-threads", "pending-works", "open-jobs", "internal-messages"];