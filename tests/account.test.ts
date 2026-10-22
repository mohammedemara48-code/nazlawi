import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as getAccount, DELETE as deleteAccount } from "@/app/api/account/route";
import { PATCH as profile } from "@/app/api/account/profile/route";
import { POST as changePassword } from "@/app/api/account/password/route";
import { POST as changeEmail } from "@/app/api/account/email/route";
import { POST as confirmEmail } from "@/app/api/auth/confirm-email-change/route";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { resetRateLimits } from "@/lib/ratelimit";
import { cookieOf, lastToken, req, reset } from "./helpers";

const user = { name: "Hoda", email: "hoda@example.com", password: "password123", role: "PROVIDER" };
async function signedUp(u = user) {
  return cookieOf(await signup(req("/x", { method: "POST", body: u }), {}));
}
const call = (fn: (r: Request, c: object) => Promise<Response>, cookie: string, body?: unknown, method = "POST", lang?: string) =>
  fn(req("/x", { method, body, cookie, lang }), {});

describe("account settings", () => {
  beforeEach(reset);

  it("requires a session on every account endpoint", async () => {
    for (const [fn, m] of [[getAccount, "GET"], [deleteAccount, "DELETE"], [profile, "PATCH"], [changePassword, "POST"], [changeEmail, "POST"]] as const) {
      const r = await (fn as (r: Request, c: object) => Promise<Response>)(req("/x", { method: m, body: m === "GET" ? undefined : {} }), {});
      expect(r.status).toBe(401);
    }
  });

  it("updates name, phone and preferred language with validation", async () => {
    const c = await signedUp();
    const ok = await call(profile, c, { name: "Hoda Ali", phone: "01011112222", locale: "en" }, "PATCH");
    expect(ok.status).toBe(200);
    expect((await ok.json()).account).toMatchObject({ name: "Hoda Ali", phone: "01011112222", locale: "en" });
    const bad = await call(profile, c, { phone: "abc", locale: "fr" }, "PATCH", "en");
    expect(bad.status).toBe(422);
    const fields = (await bad.json()).error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["phone", "locale"]));
  });

  it("changes password only with the current one and signs out other sessions", async () => {
    const c1 = await signedUp();
    const c2 = cookieOf(await login(req("/x", { method: "POST", body: { email: user.email, password: user.password } }), {}));
    const wrong = await call(changePassword, c1, { currentPassword: "nope-nope", newPassword: "newpassword1" });
    expect(wrong.status).toBe(403);
    expect((await wrong.json()).error.code).toBe("WRONG_PASSWORD");

    const ok = await call(changePassword, c1, { currentPassword: user.password, newPassword: "newpassword1" });
    expect(ok.status).toBe(200);
    const fresh = cookieOf(ok);
    expect((await me(req("/x", { cookie: fresh }), {})).status).toBe(200); // this session continues
    expect((await me(req("/x", { cookie: c1 }), {})).status).toBe(401); // old cookies are dead
    expect((await me(req("/x", { cookie: c2 }), {})).status).toBe(401);
    expect((await login(req("/x", { method: "POST", body: { email: user.email, password: "newpassword1" } }), {})).status).toBe(200);
  });

  it("changes email only after the new address confirms", async () => {
    const c = await signedUp();
    await signedUp({ ...user, email: "taken@example.com" });
    expect((await call(changeEmail, c, { password: user.password, newEmail: "taken@example.com" })).status).toBe(409);
    expect((await call(changeEmail, c, { password: "wrong-pass", newEmail: "new@example.com" })).status).toBe(403);
    expect((await call(changeEmail, c, { password: user.password, newEmail: user.email })).status).toBe(409);

    // 3 attempts per 15 min (failed ones count too)
    expect((await call(changeEmail, c, { password: user.password, newEmail: "x@example.com" })).status).toBe(429);
    await resetRateLimits();
    const r = await call(changeEmail, c, { password: user.password, newEmail: "New@Example.com" });
    expect(r.status).toBe(202);
    // not switched yet
    expect((await prisma.user.findFirstOrThrow({ where: { name: "Hoda", email: user.email } })).email).toBe(user.email);
    const token = lastToken("new@example.com");
    expect(token).not.toBe("");
    expect((await confirmEmail(req("/x", { method: "POST", body: { token } }), {})).status).toBe(200);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "new@example.com" } });
    expect(u.emailVerified).not.toBeNull();
    expect((await confirmEmail(req("/x", { method: "POST", body: { token } }), {})).status).toBe(400); // single use
  });

  it("deletes the account with listings, images and files; requires the password", async () => {
    const c = await signedUp();
    const u = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    const p = await prisma.listing.create({ data: { category: "groceries", nameAr: "محل", nameEn: "Shop", phone: "01012345678", ownerId: u.id } });
    const key = `listings/${p.id}/test.webp`;
    await storage.put(key, Buffer.from("x"), "image/webp");
    await prisma.listingImage.create({ data: { listingId: p.id, key, width: 1, height: 1 } });

    expect((await call(deleteAccount, c, { password: "wrong-pass" }, "DELETE")).status).toBe(403);
    const r = await call(deleteAccount, c, { password: user.password }, "DELETE");
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(await prisma.user.count({ where: { id: u.id } })).toBe(0);
    expect(await prisma.listing.count({ where: { id: p.id } })).toBe(0);
    expect(await prisma.listingImage.count({ where: { key } })).toBe(0);
    await expect(fs.access(path.resolve("test-uploads", key))).rejects.toThrow();
  });

  it("the last active admin cannot delete their account", async () => {
    const c = await signedUp();
    await prisma.user.update({ where: { email: user.email }, data: { role: "ADMIN" } });
    const r = await call(deleteAccount, c, { password: user.password }, "DELETE");
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("LAST_ADMIN");
  });

  it("rate-limits password change attempts", async () => {
    const c = await signedUp();
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await call(changePassword, c, { currentPassword: "wrong-pass", newPassword: "newpassword1" })).status;
    expect(last).toBe(429);
  });
});
