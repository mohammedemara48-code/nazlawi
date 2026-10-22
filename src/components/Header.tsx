import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import LangSwitch from "./LangSwitch";
import LogoutButton from "./LogoutButton";

export default async function Header({ lang }: { lang: Locale }) {
  const t = dict(lang);
  const s = await getServerSession();
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/60 bg-brand-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href={href(lang)} className="flex items-center gap-2">
          <img src="/icon.svg" alt="" width={36} height={36} className="rounded-lg" />
          <span className="font-serif text-xl font-bold text-[#C0532F] sm:text-2xl">{t.appName}</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1.5 text-sm sm:gap-2">
          <Suspense><LangSwitch lang={lang} label={t.switchLang} /></Suspense>
          {s ? (
            <>
              {s.role === "ADMIN" && <Link className="btn-outline px-3 sm:px-4" href={href(lang, "/admin")} aria-label={t.admin} title={t.admin}><span aria-hidden className="sm:hidden">🛡️</span><span className="hidden sm:inline">{t.admin}</span></Link>}
              {s.role !== "ADMIN" && <Link className="btn-outline px-3 sm:px-4" href={href(lang, "/dashboard")} aria-label={t.dashboard} title={t.dashboard}><span aria-hidden className="sm:hidden">🏪</span><span className="hidden sm:inline">{t.dashboard}</span></Link>}
              <Link className="btn-outline px-3 sm:px-4" href={href(lang, "/settings")} aria-label={t.settings} title={t.settings}><span aria-hidden className="sm:hidden">⚙️</span><span className="hidden sm:inline">{t.settings}</span></Link>
              <LogoutButton lang={lang} label={t.logout} />
            </>
          ) : (
            <Link className="btn-primary" href={href(lang, "/login")}>{t.login}</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
