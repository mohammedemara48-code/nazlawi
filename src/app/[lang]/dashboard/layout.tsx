import { redirect } from "next/navigation";
import { asLocale, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";

/** Admins moderate; they never own a store, so every /dashboard page sends them to /admin. */
export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const s = await getServerSession();
  if (s?.role === "ADMIN") redirect(href(asLocale((await params).lang), "/admin"));
  return children;
}
