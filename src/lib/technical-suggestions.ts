import { TECH_GUIDE } from './field-documents';
import { tradeFamily } from './trade-association';
import type { Edition } from './editions';

type Options = { manufacturer: string[]; model: string[]; subsystem: string[] };
const groups: Record<string, Options> = {
  lifts: { manufacturer: ['Otis','Schindler','Kone','TK Elevator','Orona','Wittur','Fermator'], model: ['Gen2','MonoSpace','Synergy'], subsystem: ['Door operator','Safety gear / governor','Hydraulic unit','Car operating panel (COP)','Lift well','Lift pit'] },
  hvac: { manufacturer: ['Daikin','Mitsubishi Electric','Carrier','Trane','Viessmann'], model: ['VRV','City Multi','Multi-split'], subsystem: ['Compressor','Condenser','Evaporator','Fan coil unit','Heat exchanger','Inverter drive','Air filter'] },
  refrigeration: { manufacturer: ['Foster','Williams','True','Arneg','Danfoss','Copeland'], model: ['EcoPro','Gastronorm'], subsystem: ['Compressor','Condenser coil','Evaporator fan','Expansion valve','Defrost heater','Door seal','Temperature sensor'] },
  plumbing: { manufacturer: ['Grundfos','Wilo','Geberit','Grohe'], model: ['Hydro MPC','MAGNA3'], subsystem: ['Circulation pump','Booster set','Pressure reducing valve','Mixing valve','Hot water cylinder','Drain trap'] },
  electrical: { manufacturer: ['Schneider Electric','ABB','Hager','Siemens'], model: ['Acti9','SENTRON'], subsystem: ['Distribution board','Circuit breaker','Contactor','Motor','Power supply','Emergency lighting'] },
  fire: { manufacturer: ['Apollo','Hochiki','Gent','C-TEC'], model: ['Discovery','ESP'], subsystem: ['Smoke detector','Heat detector','Fire alarm panel','Call point','Sounder','Sprinkler valve'] },
  security: { manufacturer: ['ASSA ABLOY','Hikvision','Axis','SALTO'], model: ['VingCard','Aperio'], subsystem: ['Keycard reader','Door lock','Access controller','CCTV camera','Motorised shutter'] },
  catering: { manufacturer: ['Rational','Hobart','Electrolux Professional','Miele Professional'], model: ['iCombi Pro','ProLine'], subsystem: ['Heating element','Wash pump','Drain pump','Door seal','Steam generator','Temperature probe'] },
};
const editionTrades: Record<Edition, string[]> = { contractor: [], hotel: ['HVAC','Plumbing','Electrical','Commercial catering equipment','Laundry','Access control'], retail: ['Commercial refrigeration','HVAC','Electrical','Commercial catering equipment','Access control','CCTV'] };
/** Configured trades are authoritative; edition defaults apply only before trade setup. */
export function technicalSuggestions(edition: Edition, industry: string, trades: string[], liftPack: boolean) {
  const chosen = trades.length ? trades : edition !== 'contractor' ? editionTrades[edition] : industry ? [industry] : [];
  const families = new Set<string>();
  for (const trade of chosen) {
    const family = tradeFamily(trade); if (family) families.add(family);
    if (/refrigerat|cold chain|freezer/i.test(trade)) families.add('refrigeration');
    if (/fire|suppression|extinguisher/i.test(trade)) families.add('fire');
    if (/security|cctv|access control|automated door/i.test(trade)) families.add('security');
    if (/catering|food service|laundry|kitchen/i.test(trade)) families.add('catering');
  }
  if (liftPack) families.add('lifts');
  const guide = Object.fromEntries(Object.entries(TECH_GUIDE).map(([key, value]) => [key, { ...value, suggestions: [...value.suggestions] }]));
  guide['trade'] = { hint: TECH_GUIDE['trade']?.hint ?? '', suggestions: [...new Set([...chosen, ...(liftPack ? ['Lifts','Escalators'] : [])])] };
  for (const key of ['manufacturer','model','subsystem'] as const) {
    guide[key] = { hint: TECH_GUIDE[key]?.hint ?? '', suggestions: [...new Set([...families].flatMap(f => groups[f]?.[key] ?? []))] };
  }
  return guide;
}