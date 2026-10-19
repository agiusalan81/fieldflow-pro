import type { Role } from "@/lib/profile";

/** Starter mobile quick actions per role, reordered by the user's own tap counts. */
export const QUICK_DEFAULTS: Record<Role, string[]> = {
  technician: ["/sheets/new", "/sheets", "/schedule", "/technical-library", "/messages", "/dwr"],
  supervisor: ["/admin/jobs?new=true", "/admin/jobs", "/team", "/standby", "/pending-works", "/messages"],
  admin: ["/admin/jobs", "/admin/jobs?new=true", "/admin/entities", "/team", "/admin/leave", "/company"],
  superuser: ["/dashboard", "/admin/jobs", "/company", "/admin/entities", "/contracts", "/team"],
};

const KEY = (uid: string) => `fieldops-nav-usage:${uid}`;

export function readUsage(uid: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY(uid)) ?? "{}") as Record<string, number>; } catch { return {}; }
}
export function recordUsage(uid: string, to: string) {
  const u = readUsage(uid);
  u[to] = (u[to] ?? 0) + 1;
  localStorage.setItem(KEY(uid), JSON.stringify(u));
}
export function resetUsage(uid: string) { localStorage.removeItem(KEY(uid)); }

/** Most-tapped first (ties keep role default order); only allowed destinations; returns `count` items. */
/** Menu-only screens that never appear as quick-action buttons for a role. */
export const MENU_ONLY: Partial<Record<Role, string[]>> = { technician: ["/hours", "/leave"] };

export function rankActions(defaults: string[], allowed: string[], usage: Record<string, number>, count = 6): string[] {
  const pool = [...new Set([...defaults, ...allowed])].filter((t) => allowed.includes(t));
  const base = (t: string) => { const i = defaults.indexOf(t); return i < 0 ? 999 : i; };
  return pool.sort((a, b) => (usage[b] ?? 0) - (usage[a] ?? 0) || base(a) - base(b)).slice(0, count);
}
