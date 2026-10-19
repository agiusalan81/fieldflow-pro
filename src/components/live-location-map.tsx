import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {locationIsFresh} from '@/lib/field-documents';
export type LocationPoint={user_id:string;latitude:number;longitude:number;accuracy:number;speed:number|null;recorded_at:string;name:string};
export default function LiveLocationMap({points}:{points:LocationPoint[]}){
 const container=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null);const [ready,setReady]=useState(false);
 useEffect(()=>{let disposed=false;let observer:ResizeObserver|undefined;void import('leaflet').then(L=>{if(!container.current||disposed)return;const instance=L.map(container.current).setView([35.9,14.45],10);map.current=instance;L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(instance);observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(container.current);setReady(true);});return()=>{disposed=true;observer?.disconnect();map.current?.remove();map.current=null;};},[]);
 useEffect(()=>{if(!ready)return;let disposed=false;void import('leaflet').then(L=>{if(disposed||!map.current)return;const group=L.layerGroup().addTo(map.current);for(const p of points){const marker=L.circleMarker([p.latitude,p.longitude],{radius:9,className:locationIsFresh(p.recorded_at,Date.now())?'location-marker':'location-marker-stale'}).addTo(group);const el=document.createElement('div');el.textContent=`${p.name} · ${Math.round(p.accuracy)} m accuracy · ${p.speed===null?'Speed unavailable':Math.round(p.speed*3.6)+' km/h'} · ${new Date(p.recorded_at).toLocaleTimeString()}`;marker.bindPopup(el);}if(points.length)map.current.fitBounds(L.latLngBounds(points.map(p=>[p.latitude,p.longitude])),{padding:[35,35],maxZoom:15});cleanup=()=>group.remove();});let cleanup=()=>{};return()=>{disposed=true;cleanup();};},[points,ready]);
 return <div ref={container} className="relative isolate z-0 h-80 w-full border bg-muted" aria-label="Live technician map"/>;
}
