import type { Edition } from "@/lib/editions";

/** Small developer credit printed in every generated document footer. */
export function platformCredit(edition: Edition = "contractor"): string {
  if (edition === "retail") return "Generated with AisleOps · aisleopsapp.com";
  if (edition === "hotel") return "Generated with FieldBridge Hotels · fieldbridgeapp.com";
  return "Generated with FieldBridge · fieldbridgeapp.com";
}

/** Contact lines for the letterhead middle column; empty values are dropped. */
export function letterheadContact(c: { address?: string | undefined; phone?: string | undefined; email?: string | undefined; website?: string | undefined }): string[] {
  return [c.address, [c.phone && `T ${c.phone}`, c.email].filter(Boolean).join(" · "), c.website]
    .map((v) => (v ?? "").trim()).filter(Boolean);
}
