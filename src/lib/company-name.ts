import { useProfile } from "@/lib/profile";

/** Personalises generic wording with the tenant's company name, e.g. "Minakel document library". */
export function companyTitle(name: string | null | undefined, thing: string) {
  const n = name?.trim();
  return n ? `${n} ${thing}` : thing.charAt(0).toUpperCase() + thing.slice(1);
}
export function useCompanyTitle(thing: string) {
  const { data } = useProfile();
  return companyTitle(data?.companies?.name, thing);
}
