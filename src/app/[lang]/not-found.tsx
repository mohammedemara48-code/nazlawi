import Link from "next/link";
import { headers } from "next/headers";
import { dict, href } from "@/lib/i18n";
import TabTitle from "@/components/TabTitle";

export default async function NotFound() {
  // not-found doesn't receive params; detect locale from the original URL.
  const h = await headers();
  const lang = h.get("x-nz-lang") === "en" ? "en" : "ar";
  const t = dict(lang);
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <TabTitle title={`${t.notFound} | ${t.appName}`} />
      <title>{`${t.notFound} | ${t.appName}`}</title>
      <p className="font-serif text-7xl font-bold text-[#C0532F]">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t.notFound}</h1>
      <p className="mt-2 text-stone-600">{t.notFoundSub}</p>
      <Link href={href(lang)} className="btn-primary mt-6">{t.backHome}</Link>
    </div>
  );
}
