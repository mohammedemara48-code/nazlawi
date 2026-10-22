import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { PATCH as updateUser } from "@/app/api/admin/users/[id]/route";
import { POST as resend } from "@/app/api/admin/users/[id]/resend-verification/route";
import { GET as audit } from "@/app/api/admin/audit/route";
import { GET as listProviders } from "@/app/api/listings/route";
import { GET as getProvider } from "@/app/api/listings/[id]/route";
import { GET as serve } from "@/app/api/uploads/[...key]/route";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { signSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { BASE, ctx, mails, req, reset } from "./helpers";

async function mkUser(email: string, role = "RESIDENT", extra: Record<string, unknown> = {}) {
  const u = await prisma.user.create({ data: { name: email.split("@")[0], email, password: await bcrypt.hash("password123", 4), role, emailVerified: new Date(), ...extra } });
  return { u, c: `nz_session=${await signSession({ sub: u.id, role: role as "ADMIN", name: u.name })}` };
}
const patch = (id: string, body: unknown, cookie: string, lang?: string) => updateUser(req("/x", { method: "PATCH", body, cookie, lang }), ctx(id));

describe("admin user management", () => {
  let admin: Awaited<ReturnType<typeof mkUser>>;
  beforeEach(async () => {
    await reset();
    admin = await mkUser("admin@t.com", "ADMIN");
  });

  it("is ADMIN only", async () => {
    const p = await mkUser("p@t.com", "PROVIDER");
    expect((await listUsers(req("/api/admin/users", { cookie: p.c }), {})).status).toBe(403);
    expect((await patch(admin.u.id, { role: "RESIDENT" }, p.c)).status).toBe(403);
    expect((await audit(req("/x", { cookie: p.c }), {})).status).toBe(403);
    expect((await listUsers(req("/api/admin/users"), {})).status).toBe(401);
  });

  it("lists users with search, pagination and listing counts", async () => {
    const p = await mkUser("sami@t.com", "PROVIDER");
    await prisma.listing.create({ data: { category: "rides", nameAr: "س", nameEn: "S", phone: "01012345678", ownerId: p.u.id } });
    for (let i = 0; i < 4; i++) await mkUser(`user${i}@t.com`);
    const all = await (await listUsers(req("/api/admin/users?pageSize=2&page=1", { cookie: admin.c }), {})).json();
    expect(all.total).toBe(6);
    expect(all.items).toHaveLength(2);
    expect(all.totalPages).toBe(3);
    const s = await (await listUsers(req("/api/admin/users?q=sami", { cookie: admin.c }), {})).json();
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ email: "sami@t.com", role: "PROVIDER", verified: true, status: "ACTIVE", listingCount: 1 });
    expect(s.items[0].password).toBeUndefined();
    expect((await listUsers(req("/api/admin/users?role=KING", { cookie: admin.c }), {})).status).toBe(422);
  });

  it("changes roles (effective immediately) and writes the audit log", async () => {
    const r = await mkUser("r@t.com");
    const res = await patch(r.u.id, { role: "PROVIDER" }, admin.c);
    expect(res.status).toBe(200);
    // existing cookie still says RESIDENT, but the server reads the role from the DB
    expect((await (await me(req("/x", { cookie: r.c }), {})).json()).user.role).toBe("PROVIDER");
    const log = await (await audit(req("/x", { cookie: admin.c }), {})).json();
    expect(log.items[0]).toMatchObject({ action: "USER_ROLE_CHANGED", actorEmail: "admin@t.com", targetId: r.u.id, meta: { from: "RESIDENT", to: "PROVIDER" } });
    expect((await patch(r.u.id, {}, admin.c)).status).toBe(422);
  });

  it("blocks self-demotion/suspension and keeps at least one active admin", async () => {
    const self = await patch(admin.u.id, { role: "RESIDENT" }, admin.c, "en");
    expect(self.status).toBe(409);
    expect((await self.json()).error).toMatchObject({ code: "CANNOT_MODIFY_SELF", message: "You can't demote or suspend your own account" });
    expect((await patch(admin.u.id, { status: "SUSPENDED" }, admin.c)).status).toBe(409);

    const a2 = await mkUser("admin2@t.com", "ADMIN");
    // a2 can demote admin1 while a2 remains active
    expect((await patch(admin.u.id, { role: "PROVIDER" }, a2.c)).status).toBe(200);
    // now a2 is the only active admin: nobody can remove them (self-check fires first for a2)
    expect((await patch(a2.u.id, { role: "RESIDENT" }, a2.c)).status).toBe(409);
  });

  it("LAST_ADMIN protects the only active admin even from another (suspended-then-restored) path", async () => {
    const a2 = await mkUser("admin2@t.com", "ADMIN", { status: "SUSPENDED" });
    // admin1 is the only ACTIVE admin; a2 is suspended so it can't act, and admin1 can't remove itself
    expect((await patch(admin.u.id, { status: "SUSPENDED" }, admin.c)).status).toBe(409);
    expect((await listUsers(req("/x", { cookie: a2.c }), {})).status).toBe(401);
  });

  it("suspension blocks login, kills sessions and hides listings and their images", async () => {
    const p = await mkUser("prov@t.com", "PROVIDER");
    const listing = await prisma.listing.create({ data: { category: "groceries", nameAr: "محل", nameEn: "Shop", phone: "01012345678", status: "APPROVED", ownerId: p.u.id } });
    const key = `listings/${listing.id}/a.webp`;
    await storage.put(key, Buffer.from("img"), "image/webp");
    await prisma.listingImage.create({ data: { listingId: listing.id, key, width: 1, height: 1 } });
    const img = () => serve(new Request(`${BASE}/api/uploads/${key}`), { params: Promise.resolve({ key: key.split("/") }) });
    expect((await img()).status).toBe(200);
    expect((await (await listProviders(req("/api/listings"), {})).json()).total).toBe(1);

    expect((await patch(p.u.id, { status: "SUSPENDED" }, admin.c)).status).toBe(200);
    expect((await me(req("/x", { cookie: p.c }), {})).status).toBe(401);
    const l = await login(req("/x", { method: "POST", body: { email: "prov@t.com", password: "password123" }, lang: "en" }), {});
    expect(l.status).toBe(403);
    expect((await l.json()).error.code).toBe("ACCOUNT_SUSPENDED");
    expect((await (await listProviders(req("/api/listings"), {})).json()).total).toBe(0);
    expect((await getProvider(req("/x"), ctx(listing.id))).status).toBe(404);
    expect((await img()).status).toBe(404);

    expect((await patch(p.u.id, { status: "ACTIVE" }, admin.c)).status).toBe(200);
    expect((await (await listProviders(req("/api/listings"), {})).json()).total).toBe(1);
    const actions = (await (await audit(req("/x", { cookie: admin.c }), {})).json()).items.map((i: { action: string }) => i.action);
    expect(actions).toEqual(["USER_UNSUSPENDED", "USER_SUSPENDED"]);
  });

  it("resends verification for unverified users and audits it", async () => {
    const u = await mkUser("unv@t.com", "PROVIDER", { emailVerified: null, locale: "en" });
    const r = await resend(req("/x", { method: "POST", cookie: admin.c }), ctx(u.u.id));
    expect(await r.json()).toEqual({ sent: true });
    expect(mails().at(-1)).toMatchObject({ to: "unv@t.com" });
    expect(mails().at(-1)!.subject).toMatch(/Confirm/); // user's preferred language
    expect((await resend(req("/x", { method: "POST", cookie: admin.c }), ctx("nope"))).status).toBe(404);
  });
});

describe("image access for non-public listings", () => {
  beforeEach(reset);

  it("serves pending/hidden listing images only to the owner or an admin", async () => {
    const owner = await mkUser("o@t.com", "PROVIDER");
    const other = await mkUser("x@t.com", "PROVIDER");
    const admin = await mkUser("a@t.com", "ADMIN");
    const l = await prisma.listing.create({ data: { category: "groceries", nameAr: "م", nameEn: "M", phone: "01012345678", status: "PENDING", ownerId: owner.u.id } });
    const key = `listings/${l.id}/p.webp`;
    await storage.put(key, Buffer.from("img"), "image/webp");
    await prisma.listingImage.create({ data: { listingId: l.id, key, width: 1, height: 1 } });
    const get = (cookie?: string) => serve(new Request(`${BASE}/api/uploads/${key}`, { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ key: key.split("/") }) });
    expect((await get()).status).toBe(404);
    expect((await get(other.c)).status).toBe(404);
    const own = await get(owner.c);
    expect(own.status).toBe(200);
    expect(own.headers.get("cache-control")).toBe("private, no-store");
    expect((await get(admin.c)).status).toBe(200);
    await prisma.listing.update({ where: { id: l.id }, data: { status: "HIDDEN" } });
    expect((await get()).status).toBe(404);
    await prisma.listing.update({ where: { id: l.id }, data: { status: "APPROVED" } });
    expect((await get()).status).toBe(200);
  });
});
