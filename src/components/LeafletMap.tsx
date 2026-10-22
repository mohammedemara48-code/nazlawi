"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

export type LatLng = { lat: number; lng: number };
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/** Default view: NEXT_PUBLIC_MAP_CENTER="lat,lng,zoom" (the village) when configured, else Egypt. */
export function defaultView(): { center: LatLng; zoom: number } {
  const [a, b, z] = (process.env.NEXT_PUBLIC_MAP_CENTER ?? "").split(",").map(Number);
  if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) return { center: { lat: a, lng: b }, zoom: Number.isFinite(z) ? z : 14 };
  return { center: { lat: 26.8, lng: 30.8 }, zoom: 6 };
}

/** Leaflet + OSM map. Interactive mode: tap to place / drag the pin. Loaded client-side only. */
export default function LeafletMap({ value, onChange, interactive = false, className = "h-64", label }: { value: LatLng | null; onChange?: (v: LatLng) => void; interactive?: boolean; className?: string; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !el.current || map.current) return;
      const lf = (mod.default ?? mod) as typeof Leaflet;
      L.current = lf;
      const d = defaultView();
      const m = lf.map(el.current, { center: value ?? d.center, zoom: value ? 16 : d.zoom, scrollWheelZoom: interactive, dragging: true, tapHold: false } as Leaflet.MapOptions);
      lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: ATTR }).addTo(m);
      if (interactive) m.on("click", (e: Leaflet.LeafletMouseEvent) => cb.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      sync(value);
    });
    return () => { dead = true; map.current?.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync(v: LatLng | null) {
    const lf = L.current, m = map.current;
    if (!lf || !m) return;
    if (!v) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      const icon = lf.divIcon({ className: "", html: '<div class="nz-pin"></div>', iconSize: [30, 42], iconAnchor: [15, 42] });
      marker.current = lf.marker(v, { icon, draggable: interactive, keyboard: interactive, title: label }).addTo(m);
      marker.current.on("dragend", () => { const p = marker.current!.getLatLng(); cb.current?.({ lat: p.lat, lng: p.lng }); });
    } else marker.current.setLatLng(v);
    if (!m.getBounds().contains(v)) m.setView(v, Math.max(m.getZoom(), 15));
  }
  useEffect(() => { sync(value); }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (value && map.current) map.current.setView(value, Math.max(map.current.getZoom(), 15)); }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} role="application" aria-label={label} className={`nz-map z-0 w-full overflow-hidden rounded-2xl border border-stone-200 ${className}`} />;
}
