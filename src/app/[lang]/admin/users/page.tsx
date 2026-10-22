import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asLocale, dict, href } from "@/lib/i18n";
import { getServerSession } from "@/lib/server-session";
import { listUsers } from "@/lib/services/admin-users";
import { adminUsersQuerySchema } from "@/lib/validation";
import AdminNav from "@/components/AdminNav";
import UserActions from "@/components/UserActions";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string>> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).users };
}
export default async function AdminUsers({ params, searchParams }: Props) {
  const lang = asLocale((await params).lang);
  const t = dict(lang);
  const s = await getServerSession();
  if (s?.role !== "ADMIN") notFound();
  const parsed = adminUsersQuerySchema.safeParse(await searchParams);
  const q = parsed.success ? parsed.data : adminUsersQuerySchema.parse({});
  const res = await listUsers(q);
  const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-EG", { dateStyle: "medium", timeZone: "Africa/Cairo" });
  const pageHref = (p: number) => href(lang, `/admin/users?${new URLSearchParams({ ...(q.q ? { q: q.q } : {}), page: String(p) })}`);
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl font-bold">{t.admin}</h1>
      <AdminNav lang={lang} active="users" />
      <form action={href(lang, "/admin/users")} className="flex gap-2">
        <input name="q" defaultValue={q.q} placeholder={t.searchUsers} className="input flex-1" />
        <button className="btn-primary">{t.search}</button>
      </form>
      <p className="text-sm text-stone-500">{t.results(res.total)}</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-start text-stone-600">
            <tr>{[t.name, t.email, t.role, t.verifiedCol, t.statusCol, t.created, t.listings, ""].map((h, i) => <th key={i} className="p-3 text-start font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {res.items.map((u) => (
              <tr key={u.id} className="border-t border-stone-100 align-top">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3" dir="ltr">{u.email}</td>
                <td className="p-3">{t.roles[u.role]}</td>
                <td className="p-3">{u.verified ? `✅ ${t.yes}` : `— ${t.no}`}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${u.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{t.userStatus[u.status]}</span></td>
                <td className="p-3 whitespace-nowrap">{fmt.format(u.createdAt)}</td>
                <td className="p-3">{u.listingCount}</td>
                <td className="p-3"><UserActions lang={lang} id={u.id} role={u.role} status={u.status} verified={u.verified} self={u.id === s.sub} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {res.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {res.page > 1 && <Link className="btn-outline" href={pageHref(res.page - 1)}>{t.prev}</Link>}
          <span>{t.page(res.page, res.totalPages)}</span>
          {res.page < res.totalPages && <Link className="btn-outline" href={pageHref(res.page + 1)}>{t.next}</Link>}
        </nav>
      )}
    </div>
  );
}
