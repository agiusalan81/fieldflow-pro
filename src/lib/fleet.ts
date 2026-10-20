export const DEFAULT_FLEET_PING_SECONDS = 30;
export type FleetPoint = { id: string; user_id: string; shift_id: string; plate: string | null; latitude: number; longitude: number; accuracy: number; recorded_at: string };
export type FleetVehicle = { plate: string; litres_per_100km: number; fuel_price_per_litre: number };
export function distanceKm(a: FleetPoint, b: FleetPoint) {
  const r = Math.PI / 180;
  const d = Math.sin((b.latitude-a.latitude)*r/2)**2 + Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin((b.longitude-a.longitude)*r/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(d),Math.sqrt(Math.max(0,1-d)));
}
export function fleetSummary(points: FleetPoint[], vehicles: FleetVehicle[]) {
  const sorted = [...points].sort((a,b)=>Date.parse(a.recorded_at)-Date.parse(b.recorded_at));
  const segments: FleetPoint[][] = []; let km=0, litres=0, cost=0, gaps=0, unconfiguredKm=0;
  for(let i=1;i<sorted.length;i++) {
    const a=sorted[i-1],b=sorted[i]; if(!a||!b)continue;
    const seconds=(Date.parse(b.recorded_at)-Date.parse(a.recorded_at))/1000;
    const distance=distanceKm(a,b);
    if(a.shift_id!==b.shift_id||a.plate!==b.plate||seconds<=0||seconds>300||a.accuracy>100||b.accuracy>100||distance/seconds*3600>160){gaps++;continue;}
    // Ignore movements inside the GPS accuracy radius instead of counting parked jitter.
    if(distance*1000<Math.max(10,a.accuracy,b.accuracy))continue;
    km+=distance; const vehicle=vehicles.find(v=>v.plate===b.plate);
    if(vehicle&&vehicle.litres_per_100km>0){const fuel=distance*vehicle.litres_per_100km/100;litres+=fuel;cost+=fuel*vehicle.fuel_price_per_litre;}else unconfiguredKm+=distance;
    segments.push([a,b]);
  }
  return {km,litres,cost,gaps,unconfiguredKm,segments};
}