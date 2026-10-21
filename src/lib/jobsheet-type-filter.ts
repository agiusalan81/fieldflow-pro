export type SheetTypeFilter = "all" | "installation" | "tech_assistance" | "maintenance";
export type SheetTypeFlags = { is_installation?: boolean | null; is_tech_assistance?: boolean | null; is_maintenance?: boolean | null };
export function matchesSheetType(s: SheetTypeFlags, f: SheetTypeFilter): boolean {
  if (f === "all") return true;
  if (f === "installation") return !!s.is_installation;
  if (f === "tech_assistance") return !!s.is_tech_assistance;
  return !!s.is_maintenance;
}
