import { beforeEach, describe, expect, it } from "vitest";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as resetPw } from "@/app/api/auth/reset-password/route";
import { POST as verify } from "@/app/api/auth/verify-email/route";
import { GET as me } from "@/app/api/auth/me/route";
import { prisma } from "@/lib/db";
import { cookieOf, lastToken, mails, req, reset } from "./helpers";

const user = { name: "Mona", email: "mona@example.com", password: "password123", role: "PROVIDER" };
const post = (path: string, body: unknown, extra: { lang?: string; ip?: string } = {}) => req(path, { method: "POST", body, ...extra });

describe("email verification", () => {
  beforeEach(reset);

  it("sends a localized verification email on sign-up and verifies once", async () => {
    const r = await signup(post("/api/auth/signup", { ...user, lang: "en" }), {});
    expect((await (await me(req("/x", { cookie: cookieOf(r) }), {})).json()).user.emailVerified).toBe(false);
    expect(mails()[0].subject).toMatch(/Confirm/);
    expect(mails()[0].text).toContain("http://localhost:3100/en/verify?token=");
    const token = lastToken(user.email);

    // DB stores only a hash
    const row = await prisma.authToken.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    expect((await verify(post("/x", { token }), {})).status).toBe(200);
    expect((await (await me(req("/x", { cookie: cookieOf(r) }), {})).json()).user.emailVerified).toBe(true);
    // single use
    const again = await verify(post("/x", { token }), {});
    expect(again.status).toBe(400);
    expect((await again.json()).error.code).toBe("TOKEN_INVALID");
  });

  it("Arabic sign-up gets an Arabic email", async () => {
    await signup(post("/api/auth/signup", user), {});
    expect(mails()[0].subject).toContain("تأكيد");
    expect(mails()[0].text).toContain("http://localhost:3100/verify?token=");
  });
});

describe("password reset", () => {
  beforeEach(async () => {
    await reset();
    await signup(post("/api/auth/signup", user), {});
  });

  it("does not reveal whether an email exists", async () => {
    const r = await forgot(post("/x", { email: "nobody@example.com" }), {});
    expect(r.status).toBe(200);
    expect(mails().filter((m) => m.to === "nobody@example.com")).toHaveLength(0);
  });

  it("resets the password with a valid token, single use", async () => {
    expect((await forgot(post("/x", { email: user.email }), {})).status).toBe(200);
    const token = lastToken(user.email);
    expect(token.length).toBeGreaterThan(20);
    expect((await resetPw(post("/x", { token, password: "newpassword1" }), {})).status).toBe(200);
    expect((await login(post("/x", { email: user.email, password: "password123" }), {})).status).toBe(401);
    expect((await login(post("/x", { email: user.email, password: "newpassword1" }), {})).status).toBe(200);
    expect((await resetPw(post("/x", { token, password: "another123" }), {})).status).toBe(400);
  });

  it("rejects expired tokens", async () => {
    await forgot(post("/x", { email: user.email }), {});
    const token = lastToken(user.email);
    await prisma.authToken.updateMany({ where: { type: "RESET_PASSWORD" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await resetPw(post("/x", { token, password: "newpassword1" }), {})).status).toBe(400);
  });

  it("a newer reset request invalidates the older token", async () => {
    await forgot(post("/x", { email: user.email }), {});
    const first = lastToken(user.email);
    await forgot(post("/x", { email: user.email }), {});
    expect((await resetPw(post("/x", { token: first, password: "newpassword1" }), {})).status).toBe(400);
    expect((await resetPw(post("/x", { token: lastToken(user.email), password: "newpassword1" }), {})).status).toBe(200);
  });

  it("validates the new password with localized messages, incl. missing fields", async () => {
    const r = await resetPw(post("/x", { token: "x".repeat(30) }, { lang: "en" }), {});
    const j = await r.json();
    expect(r.status).toBe(422);
    expect(j.error.details).toContainEqual({ field: "password", message: "This field is required" });
    const ar = await (await resetPw(post("/x", { token: "x".repeat(30) }), {})).json();
    expect(ar.error.details).toContainEqual({ field: "password", message: "هذا الحقل مطلوب" });
  });

  it("rate-limits reset requests per email", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await forgot(post("/x", { email: user.email }), {})).status);
    expect(codes.slice(0, 3)).toEqual([200, 200, 200]);
    expect(codes[4]).toBe(429);
  });
});
