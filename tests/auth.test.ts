import { beforeEach, describe, expect, it } from "vitest";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { cookieOf, req, reset } from "./helpers";

const user = { name: "Test User", email: "t@example.com", password: "password123", role: "PROVIDER" };

describe("auth API", () => {
  beforeEach(reset);

  it("signs up, sets an httpOnly cookie, and never returns the password", async () => {
    const res = await signup(req("/api/auth/signup", { method: "POST", body: user }), {});
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.user.email).toBe("t@example.com");
    expect(j.user.password).toBeUndefined();
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/);
    const m = await me(req("/api/auth/me", { cookie: cookieOf(res) }), {});
    expect((await m.json()).user.role).toBe("PROVIDER");
  });

  it("rejects self-registration as ADMIN", async () => {
    const res = await signup(req("/api/auth/signup", { method: "POST", body: { ...user, role: "ADMIN" } }), {});
    expect(res.status).toBe(422);
  });

  it("returns localized validation errors (ar default, en via Accept-Language)", async () => {
    const bad = { name: "x", email: "nope", password: "1" };
    const ar = await (await signup(req("/api/auth/signup", { method: "POST", body: bad }), {})).json();
    expect(ar.error.code).toBe("VALIDATION");
    expect(ar.error.message).toBe("البيانات المدخلة غير صحيحة");
    expect(ar.error.details.find((d: { field: string }) => d.field === "email").message).toBe("البريد الإلكتروني غير صحيح");
    const en = await (await signup(req("/api/auth/signup", { method: "POST", body: bad, lang: "en-US" }), {})).json();
    expect(en.error.message).toBe("Invalid input");
  });

  it("rejects duplicate emails with 409", async () => {
    await signup(req("/api/auth/signup", { method: "POST", body: user }), {});
    const res = await signup(req("/api/auth/signup", { method: "POST", body: user }), {});
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
  });

  it("logs in with correct password and rejects a wrong one", async () => {
    await signup(req("/api/auth/signup", { method: "POST", body: user }), {});
    const ok = await login(req("/api/auth/login", { method: "POST", body: { email: user.email, password: user.password } }), {});
    expect(ok.status).toBe(200);
    const bad = await login(req("/api/auth/login", { method: "POST", body: { email: user.email, password: "wrongpass" } }), {});
    expect(bad.status).toBe(401);
  });

  it("rate-limits repeated login attempts", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const r = await login(req("/api/auth/login", { method: "POST", body: { email: "x@example.com", password: "bad" }, ip: "1.2.3.4" }), {});
      last = r.status;
    }
    expect(last).toBe(429);
  });

  it("returns 401 for /me without a session and 400 for malformed JSON", async () => {
    expect((await me(req("/api/auth/me"), {})).status).toBe(401);
    const r = await signup(new Request("http://localhost/api/auth/signup", { method: "POST", body: "{oops" }), {});
    expect(r.status).toBe(400);
  });
});
