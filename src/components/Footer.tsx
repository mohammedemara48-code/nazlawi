import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { dict, href } from "@/lib/i18n";
export default function Footer({ lang }: { lang: Locale }) {
  const t = dict(lang);
  return (
    <footer className="mt-16 border-t border-stone-200 bg-white/70">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-stone-600 sm:flex-row">
        <p>© {new Date().getFullYear()} {t.appName}. {t.rights}.</p>
        <nav className="flex flex-wrap justify-center gap-4">
          <Link href={href(lang, "/about")} className="hover:text-[#C0532F]">{t.about}</Link>
          <Link href={href(lang, "/contact")} className="hover:text-[#C0532F]">{t.contact}</Link>
          <Link href={href(lang, "/privacy")} className="hover:text-[#C0532F]">{t.privacy}</Link>
          <Link href={href(lang, "/terms")} className="hover:text-[#C0532F]">{lang === "en" ? "Terms" : "الشروط"}</Link>
        </nav>
      </div>
    </footer>
  );
}
