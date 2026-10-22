"use client";
import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { dict } from "@/lib/i18n";
export default function ResendVerification({ lang }: { lang: Locale }) {
  const t = dict(lang);
  const [msg, setMsg] = useState<string | null>(null);
  return msg ? <span>{msg}</span> : (
    <button className="btn-outline text-sm" onClick={async () => {
      const r = await fetch(`/api/auth/resend-verification?lang=${lang}`, { method: "POST" });
      setMsg(r.ok ? t.resent : (await r.json()).error?.message ?? t.genericError);
    }}>{t.resend}</button>
  );
}
