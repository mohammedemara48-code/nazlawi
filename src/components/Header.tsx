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
          <span className="font-serif text-2xl font-bold text-[#C0532F]">{t.appName}</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Suspense><LangSwitch lang={lang} label={t.switchLang} /></Suspense>
          {s ? (
            <>
              {s.role === "ADMIN" && <Link className="btn-outline" href={href(lang, "/admin")}>{t.admin}</Link>}
              <Link className="btn-outline" href={href(lang, "/dashboard")}>{t.dashboard}</Link>
              <Link className="btn-outline" href={href(lang, "/settings")}>{t.settings}</Link>
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
