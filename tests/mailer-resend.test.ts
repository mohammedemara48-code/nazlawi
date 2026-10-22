import { describe, expect, it } from "vitest";
import { ResendMailer } from "../src/lib/mailer";

describe("ResendMailer", () => {
  it("posts to the Resend API with bearer auth", async () => {
    let call: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => { call = { url, init }; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await new ResendMailer("re_test", f).send({ to: "a@b.test", subject: "S", text: "T" });
    expect(call!.url).toBe("https://api.resend.com/emails");
    expect((call!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(call!.init.body as string)).toMatchObject({ to: ["a@b.test"], subject: "S", text: "T" });
  });
  it("throws on API errors (logged by SafeMailer in production)", async () => {
    const f = (async () => new Response("bad from", { status: 422 })) as unknown as typeof fetch;
    await expect(new ResendMailer("re_test", f).send({ to: "a@b.test", subject: "S", text: "T" })).rejects.toThrow(/422/);
  });
});
