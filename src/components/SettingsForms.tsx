"use client";
import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
import LocationField, { type Loc } from "./LocationField";

type Account = { name: string; email: string; phone: string | null; locale: string; latitude?: number | null; longitude?: number | null; addressNote?: string };
type Msg = { ok: boolean; text: string; fields?: { field: string; message: string }[] } | null;

function useSubmit(lang: Locale) {
  const t = dict(lang);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  async function run(url: string, method: string, body: unknown, okText: string, after?: () => void) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`${url}?lang=${lang}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json(); setMsg({ ok: false, text: j.error?.message ?? t.genericError, fields: j.error?.details }); return false; }
      setMsg({ ok: true, text: okText }); after?.(); return true;
    } catch { setMsg({ ok: false, text: t.genericError }); return false; } finally { setBusy(false); }
  }
  return { msg, busy, run };
}

function Alert({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div role={msg.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
      {msg.text}
      {msg.fields?.length ? <ul className="mt-1 list-disc ps-5">{msg.fields.map((f) => <li key={f.field}>{f.message}</li>)}</ul> : null}
    </div>
  );
}
const fd = (e: React.FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

export default function SettingsForms({ lang, account }: { lang: Locale; account: Account }) {
  const t = dict(lang);
  const [loc, setLoc] = useState<Loc>({ pin: account.latitude != null && account.longitude != null ? { lat: account.latitude, lng: account.longitude } : null, note: account.addressNote ?? "" });
  const profile = useSubmit(lang), pw = useSubmit(lang), email = useSubmit(lang), del = useSubmit(lang);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-serif text-3xl font-bold">{t.settings}</h1>

      <form className="card space-y-4 p-6" onSubmit={(e) => {
        e.preventDefault();
        const v = fd(e);
        profile.run("/api/account/profile", "PATCH", { ...v, latitude: loc.pin?.lat ?? null, longitude: loc.pin?.lng ?? null, addressNote: loc.note }, t.saved, () => {
          if (v.locale !== lang) window.location.href = (v.locale === "en" ? "/en" : "") + "/settings";
        });
      }}>
        <h2 className="text-xl font-bold">{t.profile}</h2>
        <Alert msg={profile.msg} />
        <div><label className="label" htmlFor="name">{t.name}</label><input id="name" name="name" className="input" defaultValue={account.name} /></div>
        <div><label className="label" htmlFor="phone">{t.phoneOptional}</label><input id="phone" name="phone" dir="ltr" className="input" defaultValue={account.phone ?? ""} /></div>
        <div><label className="label" htmlFor="locale">{t.language}</label>
          <select id="locale" name="locale" className="input" defaultValue={account.locale}><option value="ar">العربية</option><option value="en">English</option></select></div>
        <LocationField lang={lang} id="addr" value={loc} onChange={setLoc}
          title={lang === "en" ? "My address on the map (optional)" : "عنواني على الخريطة (اختياري)"}
          hint={lang === "en" ? "Tap the map to drop a pin on your home. Only you can see it." : "اضغط على الخريطة لتحديد مكان بيتك. محدش يشوفه غيرك."}
          noteLabel={lang === "en" ? "Address details / landmark (optional)" : "تفاصيل العنوان / علامة مميزة (اختياري)"} />
        <button disabled={profile.busy} className="btn-primary">{t.save}</button>
      </form>

      <form className="card space-y-4 p-6" onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (await pw.run("/api/account/password", "POST", fd(e), t.passwordChanged)) form.reset();
      }}>
        <h2 className="text-xl font-bold">{t.changePassword}</h2>
        <Alert msg={pw.msg} />
        <div><label className="label" htmlFor="currentPassword">{t.currentPassword}</label><input id="currentPassword" name="currentPassword" type="password" dir="ltr" className="input" autoComplete="current-password" /></div>
        <div><label className="label" htmlFor="newPassword">{t.newPassword}</label><input id="newPassword" name="newPassword" type="password" dir="ltr" className="input" autoComplete="new-password" /></div>
        <button disabled={pw.busy} className="btn-primary">{t.changePassword}</button>
      </form>

      <form className="card space-y-4 p-6" onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (await email.run("/api/account/email", "POST", fd(e), t.emailChangeSent)) form.reset();
      }}>
        <h2 className="text-xl font-bold">{t.changeEmail}</h2>
        <p className="text-sm text-stone-600">{t.currentEmail}: <span dir="ltr">{account.email}</span></p>
        <Alert msg={email.msg} />
        <div><label className="label" htmlFor="newEmail">{t.newEmail}</label><input id="newEmail" name="newEmail" type="email" dir="ltr" className="input" /></div>
        <div><label className="label" htmlFor="emailPassword">{t.password}</label><input id="emailPassword" name="password" type="password" dir="ltr" className="input" /></div>
        <button disabled={email.busy} className="btn-primary">{t.changeEmail}</button>
      </form>

      <form className="card space-y-4 border-red-200 p-6" onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(t.deleteConfirm)) return;
        del.run("/api/account", "DELETE", fd(e), "", () => { window.location.href = href(lang); });
      }}>
        <h2 className="text-xl font-bold text-red-700">{t.deleteAccount}</h2>
        <p className="text-sm text-stone-600">{t.deleteWarning}</p>
        <Alert msg={del.msg} />
        <div><label className="label" htmlFor="deletePassword">{t.password}</label><input id="deletePassword" name="password" type="password" dir="ltr" className="input" /></div>
        <button disabled={del.busy} className="btn border border-red-300 bg-red-600 text-white hover:bg-red-700">{t.deleteAccount}</button>
      </form>
    </div>
  );
}
