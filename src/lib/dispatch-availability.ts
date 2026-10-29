export function dispatchAvailability(date: string | null, lead: string, smart: boolean, hold: boolean, extraPlaces = false) {
  return { scheduled_date: date || null, claim_hold: hold, open_to_claim: !!date && smart && !hold && (lead === 'none' || extraPlaces) };
}