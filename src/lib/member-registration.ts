import type { Role } from "./profile";

export function splitMemberName(name: string) {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, surname: rest.join(" ") };
}
export function memberFullName(firstName: string, surname: string) {
  if (!firstName.trim() || !surname.trim()) throw new Error("Enter your first name and surname.");
  return `${firstName.trim()} ${surname.trim()}`.slice(0, 200);
}
export function canManageMember(actor: Role, actorId: string, target: { id: string; role: Role; platform_owner?: boolean }) {
  return actorId !== target.id && !target.platform_owner && (actor === "superuser" || (actor === "admin" && target.role !== "superuser"));
}
export function registrationDuration(createdAt: string, endedAt?: string | null, now = new Date()) {
  const end = endedAt ? new Date(endedAt) : now;
  const days = Math.max(0, Math.floor((end.getTime() - new Date(createdAt).getTime()) / 86_400_000));
  if (days === 0) return "Joined today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.4375);
  if (months < 12) return `${Math.max(1, months)} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"}`;
}