"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/constants";

export default function LangSwitch({ lang, label }: { lang: Locale; label: string }) {
  const path = usePathname() || "/";
  const qs = useSearchParams()?.toString();
  const base = lang === "en" ? path.replace(/^\/en(?=\/|$)/, "") || "/" : `/en${path === "/" ? "" : path}`;
  return (
    <Link href={base + (qs ? `?${qs}` : "")} className="flex items-center gap-1 px-2 py-2 font-medium hover:text-[#C0532F]">
      🌐 {label}
    </Link>
  );
}
