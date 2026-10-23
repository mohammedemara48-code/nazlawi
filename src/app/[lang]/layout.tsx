import { siteUrl } from "@/lib/site";
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
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  return {
    title: { default: `${t.appName} | ${t.tagline}`, template: `%s | ${t.appName}` },
    description: t.heroSub,
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }] },
    appleWebApp: { capable: true, title: t.appName },
    metadataBase: new URL(siteUrl()),
    alternates: { languages: { ar: "/", en: "/en" } },
    openGraph: { type: "website", siteName: t.appName, title: `${t.appName} | ${t.tagline}`, description: t.heroSub, locale: lang === "en" ? "en_US" : "ar_EG", images: [{ url: "/village-hero.jpg" }] },
    twitter: { card: "summary_large_image" },
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
        <script dangerouslySetInnerHTML={{ __html: SW_BOOT }} />
      </body>
    </html>
  );
}

// Registers the SW without HTTP caching, re-checks for a new deploy when the tab regains focus (and hourly), and when a
// new version takes over shows a bilingual "tap to refresh" toast (no forced reload, so typed forms aren't lost).
const SW_BOOT = `if("serviceWorker"in navigator){var hadCtl=!!navigator.serviceWorker.controller,shown=false;
navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(function(r){
var up=function(){r.update().catch(function(){})};document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")up()});setInterval(up,36e5)});
navigator.serviceWorker.addEventListener("controllerchange",function(){if(!hadCtl||shown)return;shown=true;
var ar=document.documentElement.lang!=="en",b=document.createElement("button");b.type="button";b.setAttribute("data-testid","sw-update");
b.textContent=ar?"نسخة جديدة متاحة — اضغط للتحديث":"New version available — tap to refresh";
b.style.cssText="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#C0532F;color:#fff;border:0;border-radius:999px;padding:10px 18px;font:inherit;box-shadow:0 4px 14px rgba(0,0,0,.2)";
b.onclick=function(){location.reload()};document.body.appendChild(b)})}`;
