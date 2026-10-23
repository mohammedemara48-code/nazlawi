import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as signup_ } from "@/app/api/auth/signup/route";
import { POST as resend_ } from "@/app/api/auth/resend-verification/route";
import { mailer } from "@/lib/mailer";
import { prisma } from "@/lib/db";
import { cookieOf, mails, req, reset } from "./helpers";

const signup = (r: Request) => signup_(r, {});
const resend = (r: Request) => resend_(r, {});
const body = (email: string) => ({ name: "Resident", email, password: "Secret-123456", role: "RESIDENT", lang: "ar" });

describe("verification email for regular (resident) users", () => {
  beforeEach(async () => { await reset(); vi.unstubAllEnvs(); });

  it("signup of a RESIDENT sends the verification email via the shared mailer with a production link", async () => {
    vi.stubEnv("APP_URL", "https://nazlawi-bwfg-waslapp.vercel.app/");
    const r = await signup(req("/api/auth/signup", { method: "POST", body: body("res@t.com") }));
    expect(r.status).toBe(201);
    const m = mails().filter((x) => x.to === "res@t.com");
    expect(m).toHaveLength(1);
    expect(m[0].text).toMatch(/^[\s\S]*https:\/\/nazlawi-bwfg-waslapp\.vercel\.app\/verify\?token=[A-Za-z0-9_-]{20,}/);
  });

  it("falls back to the Vercel production URL when APP_URL is missing", async () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "nazlawi-bwfg-waslapp.vercel.app");
    await signup(req("/api/auth/signup", { method: "POST", body: body("res2@t.com") }));
    expect(mails().at(-1)!.text).toContain("https://nazlawi-bwfg-waslapp.vercel.app/verify?token=");
  });

  it("resend: sends a fresh link, is rate-limited (3 / 15 min), and reports delivery failure", async () => {
    const r = await signup(req("/api/auth/signup", { method: "POST", body: body("res3@t.com") }));
    const c = cookieOf(r);
    const ip = "10.1.1.1";
    const a = await resend(req("/api/auth/resend-verification", { method: "POST", cookie: c, ip }));
    expect(a.status).toBe(200);
    expect(await a.json()).toMatchObject({ ok: true, sent: true });
    expect(mails().filter((x) => x.to === "res3@t.com")).toHaveLength(2);
    const spy = vi.spyOn(mailer, "send").mockResolvedValueOnce(false);
    const f = await resend(req("/api/auth/resend-verification", { method: "POST", cookie: c, ip, lang: "en" }));
    expect(f.status).toBe(502);
    spy.mockRestore();
    await resend(req("/api/auth/resend-verification", { method: "POST", cookie: c, ip }));
    expect((await resend(req("/api/auth/resend-verification", { method: "POST", cookie: c, ip }))).status).toBe(429);
  });

  it("resend does nothing for verified users and requires sign-in", async () => {
    const r = await signup(req("/api/auth/signup", { method: "POST", body: body("res4@t.com") }));
    await prisma.user.update({ where: { email: "res4@t.com" }, data: { emailVerified: new Date() } });
    const before = mails().length;
    const v = await resend(req("/api/auth/resend-verification", { method: "POST", cookie: cookieOf(r) }));
    expect(await v.json()).toMatchObject({ ok: true, alreadyVerified: true });
    expect(mails().length).toBe(before);
    expect((await resend(req("/api/auth/resend-verification", { method: "POST" }))).status).toBe(401);
  });
});
