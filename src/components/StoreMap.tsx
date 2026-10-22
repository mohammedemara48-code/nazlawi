"use client";
import dynamic from "next/dynamic";
import type { Locale } from "@/lib/constants";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false, loading: () => <div className="h-48 w-full animate-pulse rounded-2xl bg-stone-200" /> });

/** Small read-only map + external Google Maps directions link on the public store page. */
export default function StoreMap({ lang, lat, lng, landmark, title, testId }: { lang: Locale; lat: number; lng: number; landmark?: string; title?: string; testId?: string }) {
  const en = lang === "en";
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return (
    <section className="card space-y-3 p-4" data-testid={testId}>
      <h2 className="font-serif text-xl font-bold">{title ?? (en ? "Location" : "الموقع")}</h2>
      {landmark && <p className="text-sm text-stone-600">📍 {landmark}</p>}
      <LeafletMap value={{ lat, lng }} label={en ? "Store location map" : "خريطة موقع المتجر"} className="h-48 sm:h-64" />
      <a href={dir} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex">🧭 {en ? "Directions in Google Maps" : "الاتجاهات على خرائط جوجل"}</a>
    </section>
  );
}
