import { afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import sharp from "sharp";
import { POST as upload } from "@/app/api/listings/[id]/images/route";
import { DELETE as delImage } from "@/app/api/listings/[id]/images/[imageId]/route";
import { GET as serve } from "@/app/api/uploads/[...key]/route";
import { GET as getOne } from "@/app/api/listings/[id]/route";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/session";
import { BASE, reset } from "./helpers";

let ownerCookie = "", otherCookie = "", providerId = "";
async function cookieFor(email: string) {
  const u = await prisma.user.create({ data: { name: "P", email, password: "x", role: "PROVIDER", emailVerified: new Date() } });
  return { u, c: `nz_session=${await signSession({ sub: u.id, role: "PROVIDER", name: "P" })}` };
}
const png = (w = 2000, h = 1500) => sharp({ create: { width: w, height: h, channels: 3, background: "#d4704a" } }).png().toBuffer();
function uploadReq(id: string, file: Blob | null, name: string, cookie: string) {
  const fd = new FormData();
  if (file) fd.append("file", file, name);
  return new Request(`${BASE}/api/listings/${id}/images`, { method: "POST", body: fd, headers: { cookie, "accept-language": "en" } });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("listing image uploads", () => {
  beforeEach(async () => {
    await reset();
    const o = await cookieFor("owner@t.com");
    ownerCookie = o.c;
    otherCookie = (await cookieFor("other@t.com")).c;
    providerId = (await prisma.listing.create({ data: { category: "groceries", nameAr: "محل", nameEn: "Shop", phone: "01012345678", status: "APPROVED", ownerId: o.u.id } })).id;
  });
  afterAll(() => fs.rm("test-uploads", { recursive: true, force: true }));

  it("resizes valid images to WebP ≤1200px and serves them", async () => {
    const r = await upload(uploadReq(providerId, new Blob([await png()], { type: "image/png" }), "a.png", ownerCookie), ctx(providerId));
    expect(r.status).toBe(201);
    const { image } = await r.json();
    expect(image.key).toMatch(/\.webp$/);
    expect(image.width).toBe(1200);
    expect(image.height).toBe(900);
    const served = await serve(new Request(BASE + image.url), { params: Promise.resolve({ key: image.key.split("/") }) });
    expect(served.headers.get("content-type")).toBe("image/webp");
    expect((await sharp(Buffer.from(await served.arrayBuffer())).metadata()).format).toBe("webp");
    const p = await (await getOne(new Request(BASE + "/x"), ctx(providerId))).json();
    expect(p.listing.images).toHaveLength(1);
  });

  it("rejects disallowed types, spoofed content and oversized files", async () => {
    const gif = await upload(uploadReq(providerId, new Blob(["GIF89a"], { type: "image/gif" }), "a.gif", ownerCookie), ctx(providerId));
    expect(gif.status).toBe(415);
    const spoof = await upload(uploadReq(providerId, new Blob(["<?php echo 1; ?>"], { type: "image/png" }), "x.png", ownerCookie), ctx(providerId));
    expect(spoof.status).toBe(415);
    expect((await spoof.json()).error.message).toMatch(/Unsupported file type/);
    const big = await upload(uploadReq(providerId, new Blob([new Uint8Array(5 * 1024 * 1024 + 10)], { type: "image/png" }), "big.png", ownerCookie), ctx(providerId));
    expect(big.status).toBe(413);
    const none = await upload(uploadReq(providerId, null, "", ownerCookie), ctx(providerId));
    expect(none.status).toBe(422);
  });

  it("enforces ownership and the max image count", async () => {
    const file = new Blob([await png(300, 300)], { type: "image/png" });
    expect((await upload(uploadReq(providerId, file, "a.png", otherCookie), ctx(providerId))).status).toBe(403);
    let lastId = "";
    for (let i = 0; i < 4; i++) {
      const r = await upload(uploadReq(providerId, file, "a.png", ownerCookie), ctx(providerId));
      expect(r.status).toBe(201);
      lastId = (await r.json()).image.id;
    }
    expect((await upload(uploadReq(providerId, file, "a.png", ownerCookie), ctx(providerId))).status).toBe(409);
    const delCtx = { params: Promise.resolve({ id: providerId, imageId: lastId }) };
    expect((await delImage(new Request(BASE, { method: "DELETE", headers: { cookie: otherCookie } }), delCtx)).status).toBe(403);
    expect((await delImage(new Request(BASE, { method: "DELETE", headers: { cookie: ownerCookie } }), delCtx)).status).toBe(204);
    expect(await prisma.listingImage.count()).toBe(3);
  });

  it("refuses path traversal in the uploads route", async () => {
    const r = await serve(new Request(BASE), { params: Promise.resolve({ key: ["..", "..", ".env"] }) });
    expect(r.status).toBe(404);
  });
});
