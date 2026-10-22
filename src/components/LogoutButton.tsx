"use client";
import type { Locale } from "@/lib/constants";
import { href } from "@/lib/i18n";
export default function LogoutButton({ lang, label }: { lang: Locale; label: string }) {
  return (
    <button
      className="btn-primary px-3 sm:px-4"
      aria-label={label}
      title={label}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = href(lang);
      }}
    >
      <span aria-hidden className="sm:hidden">⎋</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
