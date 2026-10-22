import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asLocale } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { adminTrash, TRASH_DAYS } from "@/lib/services/trash";
import AdminNav from "@/components/AdminNav";
import AdminAction from "@/components/AdminAction";

type Props = { params: Promise<{ lang: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: asLocale((await params).lang) === "en" ? "Trash" : "المحذوفات" };
}
const purgeOn = (d: Date | null, lang: string) =>
  d ? new Date(d.getTime() + TRASH_DAYS * 86400_000).toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG", { timeZone: "Africa/Cairo" }) : "";

export default async function Trash({ params }: Props) {
  const lang = asLocale((await params).lang);
  const en = lang === "en";
  const s = await getServerSession();
  if (s?.role !== "ADMIN") notFound();
  const { stores, listings } = await adminTrash();
  const Row = ({ id, kind, name, sub, at }: { id: string; kind: "store" | "listing"; name: string; sub: string; at: Date | null }) => (
    <li className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold">{name}</p>
        <p className="text-sm text-stone-500">{sub} · {en ? "Permanently removed on" : "هيتحذف نهائياً يوم"} {purgeOn(at, lang)}</p>
      </div>
      <div className="flex gap-2">
        <AdminAction lang={lang} kind={kind} id={id} action="restore" />
        <AdminAction lang={lang} kind={kind} id={id} action="purge" />
      </div>
    </li>
  );
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{en ? "Trash" : "المحذوفات"}</h1>
      <AdminNav lang={lang} active="trash" />
      <p className="text-sm text-stone-500">{en ? `Deleted items are hidden from the site. They can be restored for ${TRASH_DAYS} days, then they are removed permanently with their photos and videos.` : `العناصر المحذوفة مخفية من الموقع. ممكن تسترجعها خلال ${TRASH_DAYS} يوم، بعدها بتتحذف نهائياً مع الصور والفيديوهات.`}</p>
      <h2 className="text-xl font-bold">{en ? "Stores" : "المتاجر"} ({stores.length})</h2>
      <ul className="space-y-3" data-testid="trash-stores">
        {stores.map((st) => <Row key={st.id} id={st.id} kind="store" name={en ? st.nameEn : st.nameAr} sub={st.owner.email} at={st.deletedAt} />)}
      </ul>
      <h2 className="text-xl font-bold">{en ? "Products" : "المنتجات"} ({listings.length})</h2>
      <ul className="space-y-3" data-testid="trash-listings">
        {listings.map((l) => <Row key={l.id} id={l.id} kind="listing" name={en ? l.nameEn : l.nameAr} sub={l.store ? (en ? l.store.nameEn : l.store.nameAr) : ""} at={l.deletedAt} />)}
      </ul>
      {!stores.length && !listings.length && <p className="card p-8 text-center text-stone-500">{en ? "Trash is empty." : "مفيش حاجة محذوفة."}</p>}
    </div>
  );
}
