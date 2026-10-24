import { addMonths, formatISO, parseISO } from "date-fns";
export const PPM_CADENCES = [
  { months: 1, label: "Monthly" },
  { months: 2, label: "Every 2 months" },
  { months: 3, label: "Quarterly" },
  { months: 4, label: "Every 4 months" },
  { months: 6, label: "Every 6 months" },
  { months: 12, label: "Yearly" },
];
export function ppmDates(first: string, end: string, months: number) {
  if (!PPM_CADENCES.some((c) => c.months === months) || end < first) return [];
  const dates: string[] = [];
  for (let n = 0; n <= 60; n++) {
    const date = formatISO(addMonths(parseISO(first), n * months), { representation: "date" });
    if (date > end) break;
    dates.push(date);
  }
  return dates;
}
export function ppmStatus(due: string, deadline: string, completed: boolean, today: string) {
  return completed
    ? "Completed"
    : today > deadline
      ? "SLA overdue"
      : today > due
        ? "Due · grace period"
        : today === due
          ? "Due today"
          : "Upcoming";
}
