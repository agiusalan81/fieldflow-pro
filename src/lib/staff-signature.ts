import type { Role } from "@/lib/profile";
export const staffSignatureEligible = (role: Role) => role === "technician" || role === "supervisor";
export function validStaffSignature(value: string | null): value is string {
  return !!value && value.length <= 200000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}