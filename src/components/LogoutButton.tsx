"use client";
import type { Locale } from "@/lib/constants";
import { href } from "@/lib/i18n";
export default function LogoutButton({ lang, label }: { lang: Locale; label: string }) {
  return (
    <button
      className="btn-primary"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = href(lang);
      }}
    >
      {label}
    </button>
  );
}
