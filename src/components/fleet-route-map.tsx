import {useEffect,useRef} from 'react';
import type {Map as LeafletMap,LatLngTuple} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {FleetPoint} from '@/lib/fleet';
export default function FleetRouteMap({segments,points}:{segments:FleetPoint[][];points:FleetPoint[]}){
 const el=useRef<HTMLDivElement>(null);
 useEffect(()=>{let disposed=false;let map:LeafletMap|undefined;let observer:ResizeObserver|undefined;
 void import('leaflet').then(L=>{if(disposed||!el.current)return;map=L.map(el.current).setView([35.9,14.45],10);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);const color=getComputedStyle(el.current).getPropertyValue('--primary').trim();for(const segment of segments)L.polyline(segment.map(p=>[p.latitude,p.longitude]),{color:color||'currentColor',weight:4}).addTo(map);const first=points[0],last=points.at(-1);for(const [p,label] of [[first,'Start'],[last,'Latest']] as const){if(p)L.circleMarker([p.latitude,p.longitude],{radius:7,color:color||'currentColor'}).addTo(map).bindTooltip(`${label} · ${p.plate??''} · ${new Date(p.recorded_at).toLocaleTimeString()}`);}if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.latitude,p.longitude])),{padding:[30,30],maxZoom:15});observer=new ResizeObserver(()=>map?.invalidateSize());observer.observe(el.current);});return()=>{disposed=true;observer?.disconnect();map?.remove();};},[segments,points]);
 return <div ref={el} aria-label="Daily vehicle route" className="relative isolate z-0 h-96 w-full border bg-muted"/>;
}