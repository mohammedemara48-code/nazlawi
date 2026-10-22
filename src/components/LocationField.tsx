"use client";
import type { Locale } from "@/lib/constants";
import MapPicker from "./MapPicker";

export type Loc = { pin: { lat: number; lng: number } | null; note: string };
/** Map pin (MapPicker) + short optional landmark. Used by every form that asks for a location/address. */
export default function LocationField({ lang, value, onChange, title, hint, noteLabel, required, error, id = "loc" }: {
  lang: Locale; value: Loc; onChange: (v: Loc) => void; title?: string; hint?: string; noteLabel?: string; required?: boolean; error?: string; id?: string;
}) {
  const en = lang === "en";
  return (
    <div className="space-y-3 sm:col-span-2" data-testid={`${id}-field`}>
      <MapPicker lang={lang} value={value.pin} onChange={(pin) => onChange({ ...value, pin })} title={title} hint={hint} required={required} error={error} />
      <div>
        <label className="label" htmlFor={`${id}-note`}>{noteLabel ?? (en ? "Landmark (optional)" : "علامة مميزة (اختياري)")}</label>
        <input id={`${id}-note`} className="input" value={value.note} maxLength={120} dir="auto"
          placeholder={en ? "e.g. next to the mosque" : "مثلاً: جنب الجامع"} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </div>
    </div>
  );
}
