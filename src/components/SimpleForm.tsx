"use client";
import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";

/** Small form that POSTs JSON to an endpoint and shows a localized success/error message. */
export default function SimpleForm({ lang, endpoint, fields, extra, submitLabel, successText, title, sub }: {
  lang: Locale; endpoint: string; fields: { name: string; label: string; type: string }[];
  extra?: Record<string, string>; submitLabel: string; successText: string; title: string; sub?: string;
}) {
  const t = dict(lang);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<{ field: string; message: string }[]>([]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy"); setErr(null); setFe([]);
    const body = { ...Object.fromEntries(new FormData(e.currentTarget)), ...extra };
    try {
      const r = await fetch(`${endpoint}?lang=${lang}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json(); setErr(j.error?.message ?? t.genericError); setFe(j.error?.details ?? []); setState("idle"); return; }
      setState("done");
    } catch { setErr(t.genericError); setState("idle"); }
  }
  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-6" noValidate>
      <h1 className="font-serif text-3xl font-bold">{title}</h1>
      {sub && <p className="text-sm text-stone-600">{sub}</p>}
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {state === "done" ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{successText}</p>
      ) : (
        <>
          {fields.map((f) => (
            <div key={f.name}>
              <label className="label" htmlFor={f.name}>{f.label}</label>
              <input id={f.name} name={f.name} type={f.type} dir="ltr" className="input" required />
              {fe.find((x) => x.field === f.name) && <p className="mt-1 text-xs text-red-600">{fe.find((x) => x.field === f.name)!.message}</p>}
            </div>
          ))}
          <button disabled={state === "busy"} className="btn-primary w-full">{submitLabel}</button>
        </>
      )}
    </form>
  );
}
