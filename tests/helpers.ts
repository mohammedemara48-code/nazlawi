import { prisma } from "@/lib/db";
import { resetRateLimits } from "@/lib/ratelimit";

export const BASE = "http://localhost";
let ip = 0;
export function req(path: string, init: { method?: string; body?: unknown; cookie?: string; lang?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": init.ip ?? `10.0.0.${++ip % 250}` };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.lang) headers["accept-language"] = init.lang;
  return new Request(BASE + path, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}
export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
export function cookieOf(res: Response) {
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}
import type { Mail } from "@/lib/mailer";
export const mails = () => (globalThis as unknown as { sentMails: Mail[] }).sentMails;
/** Extracts the token from the last email sent to `to`. */
export function lastToken(to: string) {
  const m = [...mails()].reverse().find((x) => x.to === to);
  return m?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? "";
}
export async function reset() {
  await resetRateLimits();
  mails().length = 0;
  await prisma.auditLog.deleteMany();
  await prisma.authToken.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.videoJob.deleteMany();
  await prisma.video.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.listingGroup.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();
}
