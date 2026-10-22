"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/constants";
import type { LatLng } from "./LeafletMap";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-stone-200" /> });

const T = {
  ar: { title: "الموقع على الخريطة (اختياري)", hint: "اضغط على الخريطة لوضع دبوس على متجرك أو عيادتك، وتقدر تسحب الدبوس لتعديله.", use: "استخدم موقعي", locating: "جارٍ تحديد موقعك…", remove: "إزالة الدبوس", denied: "مسموحش بالوصول للموقع. فعّل إذن الموقع وحاول تاني، أو اضغط على الخريطة.", fail: "تعذر تحديد موقعك. اضغط على الخريطة بدلاً من ذلك.", unsupported: "جهازك لا يدعم تحديد الموقع.", map: "خريطة موقع المتجر" },
  en: { title: "Location on map (optional)", hint: "Tap the map to drop a pin on your shop or clinic; drag the pin to adjust it.", use: "Use my location", locating: "Finding your location…", remove: "Remove pin", denied: "Location permission was denied. Allow it and try again, or tap the map.", fail: "Couldn't get your location. Tap the map instead.", unsupported: "Your device doesn't support location.", map: "Store location map" },
};
const round = (v: LatLng): LatLng => ({ lat: Math.round(v.lat * 1e6) / 1e6, lng: Math.round(v.lng * 1e6) / 1e6 });

export default function MapPicker({ lang, value, onChange, error }: { lang: Locale; value: LatLng | null; onChange: (v: LatLng | null) => void; error?: string }) {
  const t = T[lang];
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<(LatLng & { zoom: number }) | null>(null);
  const [auto, setAuto] = useState(false);
  // No saved pin: quietly try the device location and recenter (never drops a pin). Denied/timeout -> keep fallback.
  useEffect(() => {
    if (value || typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    let done = false;
    setAuto(true);
    const stop = setTimeout(() => { done = true; setAuto(false); }, 8500);
    navigator.geolocation.getCurrentPosition(
      (p) => { if (done) return; done = true; clearTimeout(stop); setAuto(false); setFocus({ lat: p.coords.latitude, lng: p.coords.longitude, zoom: 16 }); },
      () => { done = true; clearTimeout(stop); setAuto(false); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 },
    );
    return () => { done = true; clearTimeout(stop); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function locate() {
    setMsg(null);
    if (!("geolocation" in navigator)) return setMsg(t.unsupported);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onChange(round({ lat: p.coords.latitude, lng: p.coords.longitude })); },
      (e) => { setBusy(false); setMsg(e.code === e.PERMISSION_DENIED ? t.denied : t.fail); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="label">{t.title}</p>
      <p className="text-xs text-stone-500">{t.hint}</p>
      <div className="relative">
        <LeafletMap interactive focus={value ? null : focus} value={value} onChange={(v) => onChange(round(v))} label={t.map} className="h-64 sm:h-80" />
        {auto && !value && <span role="status" className="pointer-events-none absolute start-2 top-2 z-[500] rounded-full bg-white/90 px-3 py-1 text-xs text-stone-600 shadow">{t.locating}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={locate} disabled={busy} className="btn-outline inline-flex items-center gap-2">
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          {busy ? t.locating : t.use}
        </button>
        {value && <button type="button" onClick={() => onChange(null)} className="btn-outline text-red-700">✕ {t.remove}</button>}
        {value && <span dir="ltr" className="text-xs text-stone-500">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>}
      </div>
      {(msg || error) && <p role="alert" className="text-xs text-red-600">{msg ?? error}</p>}
    </div>
  );
}
