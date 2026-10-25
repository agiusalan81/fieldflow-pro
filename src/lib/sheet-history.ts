import { subMonths } from 'date-fns';
export const HISTORY_MONTHS = [1,3,6,12] as const;
export function sheetWithinHistory(createdAt:string,months:number,now=new Date()) {
  const safeMonths=HISTORY_MONTHS.includes(months as 1|3|6|12)?months:12;
  return new Date(createdAt).getTime()>=subMonths(now,safeMonths).getTime();
}