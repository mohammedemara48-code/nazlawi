"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";

export default function VerifyEmail({ lang, token, endpoint = "/api/auth/verify-email", mode = "verify" }: { lang: Locale; token: string; endpoint?: string; mode?: "verify" | "change" }) {
  const t = dict(lang);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; // StrictMode double-invoke would burn the single-use token
    ran.current = true;
    fetch(`${endpoint}?lang=${lang}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (r) => setMsg(r.ok ? { ok: true, text: mode === "change" ? t.emailChanged : t.verified } : { ok: false, text: (await r.json()).error?.message ?? t.genericError }))
      .catch(() => setMsg({ ok: false, text: t.genericError }));
  }, [lang, token, t, endpoint, mode]);
  return (
    <div className="card mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="font-serif text-3xl font-bold">{mode === "change" ? t.confirmEmailTitle : t.verifyTitle}</h1>
      {!msg ? <p>{t.verifying}</p> : <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <Link href={href(lang, "/dashboard")} className="btn-primary">{t.dashboard}</Link>
    </div>
  );
}
