import type { PdfTemplate } from "./documents";

export type PdfSheetData = {
  company: string; logo?: string; officeAddress?: string; vatNumber?: string; contact?: string; workType?: string;
  number: string | number; date: string; client: string; address: string; asset: string;
  fault: string; repairs: string; technician: string; technicianSignature?: string | null | undefined;
  signedBy: string; idCard: string; signature: string | null;
  logs: { date: string; in: string; out: string; travel: number; total: number; techs: string; count: number }[];
  parts: { desc: string; unit: string; qty: number }[];
  notes: string | null; terms: string | null; template: PdfTemplate;
};
export function serviceEquipment(type: string | null, reference: string | null | undefined, model: string | null, serial: string | null) { return [type, reference, model && `Model ${model}`, serial && `S/N ${serial}`].filter(Boolean).join(" - ") || "-"; }
