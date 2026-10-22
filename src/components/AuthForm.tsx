"use client";
import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";

type FieldErr = { field: string; message: string };
export default function AuthForm({ lang, mode, next }: { lang: Locale; mode: "login" | "signup"; next?: string }) {
  const t = dict(lang);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErr[]>([]);
  const [busy, setBusy] = useState(false);
  const fe = (f: string) => fields.find((x) => x.field === f)?.message;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null); setFields([]);
    const body = { ...Object.fromEntries(new FormData(e.currentTarget)), ...(mode === "signup" ? { lang } : {}) };
    try {
      const r = await fetch(`/api/auth/${mode}?lang=${lang}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error?.message ?? t.genericError); setFields(j.error?.details ?? []); return; }
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : href(lang, "/dashboard"); // admins are redirected to /admin by the dashboard layout
      window.location.href = safeNext;
    } catch { setErr(t.genericError); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-6" noValidate>
      <h1 className="font-serif text-3xl font-bold">{mode === "login" ? t.login : t.signup}</h1>
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {mode === "signup" && (
        <div><label className="label" htmlFor="name">{t.name}</label><input id="name" name="name" className="input" required />
          {fe("name") && <p className="mt-1 text-xs text-red-600">{fe("name")}</p>}</div>
      )}
      <div><label className="label" htmlFor="email">{t.email}</label><input id="email" name="email" type="email" dir="ltr" className="input" required />
        {fe("email") && <p className="mt-1 text-xs text-red-600">{fe("email")}</p>}</div>
      <div><label className="label" htmlFor="password">{t.password}</label><input id="password" name="password" type="password" dir="ltr" className="input" required />
        {fe("password") && <p className="mt-1 text-xs text-red-600">{fe("password")}</p>}</div>
      {mode === "signup" && (
        <fieldset><legend className="label">{t.accountType}</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="role" value="RESIDENT" defaultChecked /> {t.resident}</label>
          <label className="mt-1 flex items-center gap-2 text-sm"><input type="radio" name="role" value="PROVIDER" /> {t.provider}</label>
        </fieldset>
      )}
      {mode === "login" && <Link href={href(lang, "/forgot-password")} className="block text-sm text-[#C0532F]">{t.forgot}</Link>}
      <button disabled={busy} className="btn-primary w-full">{mode === "login" ? t.login : t.signup}</button>
      <p className="text-center text-sm text-stone-600">
        {mode === "login" ? t.noAccount : t.haveAccount}{" "}
        <Link className="font-semibold text-[#C0532F]" href={href(lang, mode === "login" ? "/signup" : "/login")}>{mode === "login" ? t.signup : t.login}</Link>
      </p>
    </form>
  );
}
