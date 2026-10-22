"use client";
import { useState } from "react";
import type { Locale } from "@/lib/constants";
import { href } from "@/lib/i18n";
import { apiCall } from "./api-client";

/** Admin: one-click demo grocery store (sample prices, clearly marked) and its removal. */
export default function DemoStorePanel({ lang, exists, slug }: { lang: Locale; exists: boolean; slug: string }) {
  const en = lang === "en";
  const [has, setHas] = useState(exists);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run(method: "POST" | "DELETE") {
    if (method === "DELETE" && !confirm(en ? "Remove the demo store and all its products?" : "حذف المتجر التجريبي وكل منتجاته؟")) return;
    setBusy(true); setMsg(null);
    const r = await apiCall("/api/admin/demo-store", lang, { method });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setHas(method === "POST");
    setMsg(method === "POST" ? (en ? "Demo store is ready." : "المتجر التجريبي جاهز.") : (en ? "Demo store removed." : "تم حذف المتجر التجريبي."));
  }
  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-bold">{en ? "Demo grocery store" : "متجر بقالة تجريبي"}</h2>
      <p className="text-sm text-stone-600">{en ? "“بقالة نزلاوي (تجريبي)” with 7 sections and sample prices, owned by a demo account nobody can sign in to. Marked as demo everywhere." : "«بقالة نزلاوي (تجريبي)» فيها ٧ أقسام وأسعار تجريبية، مملوكة لحساب تجريبي محدش يقدر يدخل بيه، وعليها علامة «تجريبي» في كل مكان."}</p>
      {msg && <p role="status" className="text-sm text-emerald-800">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        {has ? (
          <>
            <a href={href(lang, `/s/${slug}`)} className="btn-outline text-sm">{en ? "Open demo store" : "افتح المتجر التجريبي"}</a>
            <button type="button" disabled={busy} onClick={() => run("DELETE")} className="btn border border-red-200 bg-red-50 text-sm text-red-700">{en ? "Remove demo store" : "حذف المتجر التجريبي"}</button>
          </>
        ) : <button type="button" disabled={busy} onClick={() => run("POST")} className="btn-primary text-sm">{en ? "Create demo store" : "إنشاء المتجر التجريبي"}</button>}
      </div>
    </section>
  );
}
