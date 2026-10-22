import type { Metadata, Viewport } from "next";
import NativeBridge from "@/components/NativeBridge";
import { Cairo, Amiri } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { LOCALES } from "@/lib/constants";
import { asLocale, dict } from "@/lib/i18n";

const sans = Cairo({ subsets: ["arabic", "latin"], variable: "--font-sans", display: "swap" });
const serif = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-serif", display: "swap" });

export const dynamicParams = false;
export const dynamic = "force-dynamic"; // header reads the session cookie
export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));
export const viewport: Viewport = { themeColor: "#D4704A" };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const t = dict(asLocale((await params).lang));
  return {
    title: { default: `${t.appName} | ${t.tagline}`, template: `%s | ${t.appName}` },
    description: t.heroSub,
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }] },
    appleWebApp: { capable: true, title: t.appName },
    alternates: { languages: { ar: "/", en: "/en" } },
  };
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LOCALES.includes(lang as never)) notFound();
  const l = asLocale(lang);
  return (
    <html lang={l} dir={l === "ar" ? "rtl" : "ltr"} className={`${sans.variable} ${serif.variable}`}>
      <body className="flex min-h-screen flex-col overflow-x-hidden font-sans">
        <NativeBridge />
        <Header lang={l} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <Footer lang={l} />
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js")` }} />
      </body>
    </html>
  );
}
