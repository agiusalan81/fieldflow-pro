/** Each independently mounted editor can write only the fields it owns. */
const FIELDS = {
  terms: ["terms", "note_presets"],
  branding: ["pdf_template"],
  details: ["office_phone", "whatsapp_phone", "emergency_phone", "company_email", "website", "company_address", "pe_number", "office_address", "vat_number", "app_title"],
  fonts: ["theme"],
} as const;

export function settingsSectionPatch(section: keyof typeof FIELDS, values: Record<string, unknown>) {
  return Object.fromEntries(FIELDS[section].filter(key => Object.hasOwn(values, key)).map(key => [key, values[key]]));
}