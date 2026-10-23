import { standbyFor, type StandbyConfig, type Swap } from "@/lib/dwr";

export type RotaTrack = "technician" | "supervisor";
export const ROTA_TRACKS: RotaTrack[] = ["technician", "supervisor"];
export const trackLabel = (track: RotaTrack) => track === "technician" ? "Tech" : "Supervisor";
export function rotaFor(date: string, config: StandbyConfig, swaps: (Swap & { track?: string })[], track: RotaTrack) {
  return standbyFor(date, config, swaps.filter(s => (s.track ?? "technician") === track));
}
export function validRota(config: StandbyConfig, eligibleIds: string[]) {
  return !!config.start && [1, 2, 3, 7, 14].includes(config.rotationDays)
    && new Set(config.order).size === config.order.length
    && config.order.every(id => eligibleIds.includes(id))
    && Number.isInteger(config.perShift) && config.perShift >= 1
    && (config.order.length === 0 ? config.perShift === 1 : config.perShift <= config.order.length);
}
export function freeForRange(id: string, start: string, end: string, config: StandbyConfig, swaps: (Swap & { track?: string })[], track: RotaTrack) {
  const first = Date.parse(start + "T00:00:00Z"); const last = Date.parse(end + "T00:00:00Z");
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last - first > 30 * 86400000) return false;
  for (let day = first; day <= last; day += 86400000) {
    if (rotaFor(new Date(day).toISOString().slice(0, 10), config, swaps, track).includes(id)) return false;
  }
  return true;
}