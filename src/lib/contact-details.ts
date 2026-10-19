export type OfficeAddress = { building: string; street: string; city: string; postalCode: string };
export function parseOfficeAddress(raw: unknown, legacy = ""): OfficeAddress {
  const r = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const field = (k: string) => typeof r[k] === "string" ? r[k] as string : "";
  return { building: field("building"), street: field("street") || (Object.keys(r).length ? "" : legacy), city: field("city"), postalCode: field("postalCode") };
}
export function formatOfficeAddress(address: OfficeAddress) {
  return [address.building.trim(), address.street.trim(), [address.city.trim(), address.postalCode.trim()].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}
export function parsePhone(value: string | null | undefined, fallback: string, knownCodes: string[]) {
  const phone = value ?? "";
  const separated = phone.match(/^(\+\d{1,4})\s+(.*)$/);
  if (separated) return { code: separated[1] ?? fallback, number: separated[2] ?? "" };
  if (phone === fallback || knownCodes.includes(phone)) return { code: phone, number: "" };
  const code = [...knownCodes].sort((a,b) => b.length-a.length).find((c) => phone.startsWith(c));
  return code ? { code, number: phone.slice(code.length) } : { code: fallback, number: phone };
}