/** Audience rules for reusable documents: who may see a document and which sections each copy prints. */

export type Audience = "technician" | "client";
export const AUDIENCES: { key: Audience; label: string }[] = [
  { key: "technician", label: "Technicians" },
  { key: "client", label: "Clients" },
];
/** "both" sections print on every copy; others print only on that audience's copy. */
export type SectionAudience = "both" | Audience;
export type DocSection = { title: string; body: string; audience: SectionAudience };

export function parseAudience(raw: unknown): Audience[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((a): a is Audience => a === "technician" || a === "client"))] : [];
}

export function toggleAudience(list: Audience[], a: Audience): Audience[] {
  return list.includes(a) ? list.filter((x) => x !== a) : [...list, a];
}

export function parseSections(raw: unknown): DocSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const r = s as Record<string, unknown>;
    const audience: SectionAudience = r.audience === "client" || r.audience === "technician" ? r.audience : "both";
    return [{ title: typeof r.title === "string" ? r.title : "", body: typeof r.body === "string" ? r.body : "", audience }];
  });
}

/** Sections printed on a copy for the given audience. */
export function sectionsFor(sections: DocSection[], view: Audience): DocSection[] {
  return sections.filter((s) => s.audience === "both" || s.audience === view);
}

/** Office roles (superuser, admin, supervisor) always see; technicians only when the document targets them. */
export function canViewDocument(role: string | undefined, audience: Audience[]): boolean {
  if (role === "superuser" || role === "admin" || role === "supervisor") return true;
  return role === "technician" && audience.includes("technician");
}

export const TECH_CHECK_OPTIONS = ["Pass", "Fail", "N/A"] as const;
