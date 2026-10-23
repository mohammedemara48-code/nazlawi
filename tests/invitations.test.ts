import { afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import sharp from "sharp";
import { GET as feed_, POST as createPostApi_ } from "@/app/api/posts/route";
import { DELETE as deletePostApi } from "@/app/api/posts/[id]/route";
import { POST as likeApi } from "@/app/api/posts/[id]/like/route";
import { POST as commentApi } from "@/app/api/posts/[id]/comments/route";
import { DELETE as deleteCommentApi } from "@/app/api/comments/[id]/route";
import { POST as reportApi_ } from "@/app/api/reports/route";
import { GET as adminReports_, DELETE as dismissApi_ } from "@/app/api/admin/reports/route";
import { POST as avatarApi_, DELETE as avatarDelete_ } from "@/app/api/account/avatar/route";
import { GET as serve } from "@/app/api/uploads/[...key]/route";
import { POST as createStoreApi_ } from "@/app/api/stores/route";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/session";
import { storage } from "@/lib/storage";
import { storeCreateSchema } from "@/lib/validation";
import { BASE, ctx, req, reset } from "./helpers";
const feed = (r: Request) => feed_(r, {});
const createPostApi = (r: Request) => createPostApi_(r, {});
const reportApi = (r: Request) => reportApi_(r, {});
const adminReports = (r: Request) => adminReports_(r, {});
const dismissApi = (r: Request) => dismissApi_(r, {});
const avatarApi = (r: Request) => avatarApi_(r, {});
const avatarDelete = (r: Request) => avatarDelete_(r, {});
const createStoreApi = (r: Request) => createStoreApi_(r, {});

async function user(email: string, role: "RESIDENT" | "PROVIDER" | "ADMIN" = "RESIDENT") {
  const u = await prisma.user.create({ data: { name: email.split("@")[0], email, password: "x", role, emailVerified: new Date() } });
  return { u, c: `nz_session=${await signSession({ sub: u.id, role, name: u.name })}` };
}
const png = () => sharp({ create: { width: 900, height: 1200, channels: 3, background: "#d4704a" } }).png().toBuffer();
async function postReq(url: string, cookie: string, file: Blob | null, fields: Record<string, string> = {}, name = "a.png") {
  const fd = new FormData();
  if (file) fd.append("file", file, name);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request(BASE + url, { method: "POST", body: fd, headers: { cookie, "accept-language": "en", "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.1` } });
}
const keyCtx = (key: string) => ({ params: Promise.resolve({ key: key.split("/") }) });
async function newPost(cookie: string, caption = "Wedding on Thursday") {
  const r = await createPostApi(await postReq("/api/posts", cookie, new Blob([await png()], { type: "image/png" }), { caption }));
  return { r, post: r.status === 201 ? (await r.json()).post : null };
}

describe("event invitations timeline", () => {
  let res: Awaited<ReturnType<typeof user>>, other: Awaited<ReturnType<typeof user>>, prov: Awaited<ReturnType<typeof user>>, admin: Awaited<ReturnType<typeof user>>;
  beforeEach(async () => {
    await reset();
    await prisma.postReport.deleteMany(); await prisma.post.deleteMany();
    res = await user("res@t.com"); other = await user("other@t.com"); prov = await user("prov@t.com", "PROVIDER"); admin = await user("admin@t.com", "ADMIN");
  });
  afterAll(() => fs.rm("test-uploads", { recursive: true, force: true }));

  it("residents post an image + caption; the image is re-encoded to WebP and served publicly", async () => {
    const { r, post } = await newPost(res.c);
    expect(r.status).toBe(201);
    expect(post.imageKey).toMatch(/^posts\/.+\.webp$/);
    expect(post.caption).toBe("Wedding on Thursday");
    expect(post.author.name).toBe("res");
    const img = await serve(new Request(BASE + "/api/uploads/" + post.imageKey), keyCtx(post.imageKey));
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/webp");
    const f = await (await feed(req("/api/posts"))).json();
    expect(f.items).toHaveLength(1);
  });

  it("rejects anonymous users, service providers, missing/invalid images and long captions", async () => {
    const blob = new Blob([await png()], { type: "image/png" });
    expect((await createPostApi(await postReq("/api/posts", "", blob))).status).toBe(401);
    expect((await createPostApi(await postReq("/api/posts", prov.c, blob))).status).toBe(403);
    expect((await createPostApi(await postReq("/api/posts", res.c, null))).status).toBe(422);
    expect((await createPostApi(await postReq("/api/posts", res.c, new Blob(["not an image"], { type: "image/png" })))).status).toBe(415);
    expect((await createPostApi(await postReq("/api/posts", other.c, new Blob(["x"], { type: "text/plain" }), {}, "a.txt"))).status).toBe(415);
    expect((await createPostApi(await postReq("/api/posts", admin.c, blob, { caption: "x".repeat(501) }))).status).toBe(422);
    expect(await prisma.post.count()).toBe(0);
  });

  it("rate-limits posting (burst)", async () => {
    expect((await newPost(res.c)).r.status).toBe(201);
    expect((await newPost(res.c)).r.status).toBe(201);
    expect((await newPost(res.c)).r.status).toBe(429);
  });

  it("likes toggle and comments work for any signed-in user (providers included)", async () => {
    const { post } = await newPost(res.c);
    const l1 = await (await likeApi(req(`/api/posts/${post.id}/like`, { method: "POST", cookie: prov.c }), ctx(post.id))).json();
    expect(l1).toEqual({ liked: true, count: 1 });
    await likeApi(req(`/api/posts/${post.id}/like`, { method: "POST", cookie: other.c }), ctx(post.id));
    const l3 = await (await likeApi(req(`/api/posts/${post.id}/like`, { method: "POST", cookie: prov.c }), ctx(post.id))).json();
    expect(l3).toEqual({ liked: false, count: 1 });
    expect((await likeApi(req(`/api/posts/${post.id}/like`, { method: "POST" }), ctx(post.id))).status).toBe(401);
    const c = await commentApi(req(`/api/posts/${post.id}/comments`, { method: "POST", cookie: prov.c, body: { body: "مبروك" } }), ctx(post.id));
    expect(c.status).toBe(201);
    expect((await commentApi(req(`/api/posts/${post.id}/comments`, { method: "POST", cookie: prov.c, body: { body: "  " } }), ctx(post.id))).status).toBe(422);
    const f = await (await feed(req("/api/posts", { cookie: other.c }))).json();
    expect(f.items[0]).toMatchObject({ likeCount: 1, commentCount: 1, liked: true });
    expect(f.items[0].comments[0]).toMatchObject({ body: "مبروك", author: { name: "prov" } });
  });

  it("authors delete their own post/comment; others can't; admin deletes anything permanently (file removed)", async () => {
    const { post } = await newPost(res.c);
    const cm = (await (await commentApi(req(`/api/posts/${post.id}/comments`, { method: "POST", cookie: other.c, body: { body: "hi" } }), ctx(post.id))).json()).comment;
    expect((await deleteCommentApi(req(`/api/comments/${cm.id}`, { method: "DELETE", cookie: res.c }), ctx(cm.id))).status).toBe(403);
    expect((await deleteCommentApi(req(`/api/comments/${cm.id}`, { method: "DELETE", cookie: other.c }), ctx(cm.id))).status).toBe(200);
    expect((await deletePostApi(req(`/api/posts/${post.id}`, { method: "DELETE", cookie: other.c }), ctx(post.id))).status).toBe(403);
    expect((await deletePostApi(req(`/api/posts/${post.id}`, { method: "DELETE", cookie: res.c }), ctx(post.id))).status).toBe(200);
    expect(await storage.get(post.imageKey)).toBeNull();
    const p2 = (await newPost(other.c)).post;
    const cm2 = (await (await commentApi(req(`/api/posts/${p2.id}/comments`, { method: "POST", cookie: res.c, body: { body: "x" } }), ctx(p2.id))).json()).comment;
    expect((await deleteCommentApi(req(`/api/comments/${cm2.id}`, { method: "DELETE", cookie: admin.c }), ctx(cm2.id))).status).toBe(200);
    expect((await deletePostApi(req(`/api/posts/${p2.id}`, { method: "DELETE", cookie: admin.c }), ctx(p2.id))).status).toBe(200);
    expect(await prisma.post.count()).toBe(0);
    expect(await prisma.postComment.count()).toBe(0);
    const s = await serve(new Request(BASE + "/api/uploads/" + p2.imageKey), keyCtx(p2.imageKey));
    expect(s.status).toBe(404);
    expect(await prisma.auditLog.count({ where: { action: { in: ["POST_DELETED", "COMMENT_DELETED"] } } })).toBe(2);
  });

  it("reports: once per user per target; admin lists, dismisses, and non-admins can't", async () => {
    const { post } = await newPost(res.c);
    const cm = (await (await commentApi(req(`/api/posts/${post.id}/comments`, { method: "POST", cookie: res.c, body: { body: "spam" } }), ctx(post.id))).json()).comment;
    expect((await reportApi(req("/api/reports", { method: "POST", cookie: other.c, body: { postId: post.id, reason: "fake" } }))).status).toBe(201);
    expect((await reportApi(req("/api/reports", { method: "POST", cookie: other.c, body: { postId: post.id } }))).status).toBe(409);
    expect((await reportApi(req("/api/reports", { method: "POST", cookie: prov.c, body: { commentId: cm.id } }))).status).toBe(201);
    expect((await reportApi(req("/api/reports", { method: "POST", cookie: prov.c, body: {} }))).status).toBe(422);
    expect((await reportApi(req("/api/reports", { method: "POST", body: { postId: post.id } }))).status).toBe(401);
    expect((await adminReports(req("/api/admin/reports", { cookie: res.c }))).status).toBe(403);
    const list = await (await adminReports(req("/api/admin/reports", { cookie: admin.c }))).json();
    expect(list.items).toHaveLength(2);
    expect((await dismissApi(req("/api/admin/reports", { method: "DELETE", cookie: admin.c, body: { postId: post.id } }))).status).toBe(200);
    expect(await prisma.postReport.count()).toBe(1);
    await deleteCommentApi(req(`/api/comments/${cm.id}`, { method: "DELETE", cookie: admin.c }), ctx(cm.id));
    expect(await prisma.postReport.count()).toBe(0);
  });

  it("hides posts of suspended users", async () => {
    await newPost(res.c);
    await prisma.user.update({ where: { id: res.u.id }, data: { status: "SUSPENDED" } });
    expect((await (await feed(req("/api/posts"))).json()).items).toHaveLength(0);
  });
});

describe("profile photo", () => {
  beforeEach(async () => { await reset(); });
  it("any user uploads a 400x400 WebP avatar, replaces it (old file removed) and removes it", async () => {
    const { u, c } = await user("me@t.com");
    const r1 = await avatarApi(await postReq("/api/account/avatar", c, new Blob([await png()], { type: "image/png" })));
    expect(r1.status).toBe(201);
    const k1 = (await r1.json()).user.avatarKey as string;
    const meta = await sharp((await storage.get(k1))!).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 400, 400]);
    expect((await serve(new Request(BASE + "/api/uploads/" + k1), keyCtx(k1))).status).toBe(200);
    const k2 = (await (await avatarApi(await postReq("/api/account/avatar", c, new Blob([await png()], { type: "image/png" })))).json()).user.avatarKey;
    expect(k2).not.toBe(k1);
    expect(await storage.get(k1)).toBeNull();
    expect((await avatarDelete(req("/api/account/avatar", { method: "DELETE", cookie: c }))).status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.avatarKey).toBeNull();
    expect((await avatarApi(await postReq("/api/account/avatar", "", new Blob([await png()], { type: "image/png" })))).status).toBe(401);
  });
});

describe("new provider sections: crafts / productive families / event preparation", () => {
  beforeEach(async () => { await reset(); });
  const base = { nameAr: "محل", nameEn: "Shop", phone: "01012345678" };
  it("validates craft sub-types and the custom craft name", () => {
    expect(storeCreateSchema.safeParse({ ...base, category: "crafts" }).success).toBe(false);
    expect(storeCreateSchema.safeParse({ ...base, category: "crafts", subcategory: "doctors" }).success).toBe(false);
    expect(storeCreateSchema.safeParse({ ...base, category: "crafts", subcategory: "plumber" }).success).toBe(true);
    expect(storeCreateSchema.safeParse({ ...base, category: "crafts", subcategory: "other_craft" }).success).toBe(false);
    expect(storeCreateSchema.safeParse({ ...base, category: "crafts", subcategory: "other_craft", craftName: "نقاش" }).success).toBe(true);
    expect(storeCreateSchema.safeParse({ ...base, category: "medical", subcategory: "plumber" }).success).toBe(false);
    expect(storeCreateSchema.safeParse({ ...base, category: "families" }).success).toBe(true);
    expect(storeCreateSchema.safeParse({ ...base, category: "events" }).success).toBe(true);
  });
  it("creates stores in the new sections; custom craft name is kept only for 'other'; searchable by trade", async () => {
    const mk = async (email: string, body: Record<string, unknown>) => {
      const { c } = await user(email, "PROVIDER");
      const r = await createStoreApi(req("/api/stores", { method: "POST", cookie: c, body: { ...base, nameEn: email.split("@")[0], ...body } }));
      return { status: r.status, store: (await r.json()).store };
    };
    const a = await mk("painter@t.com", { category: "crafts", subcategory: "other_craft", craftName: "نقاش" });
    expect(a.status).toBe(201);
    expect(a.store).toMatchObject({ category: "crafts", subcategory: "other_craft", craftName: "نقاش" });
    const b = await mk("plumb@t.com", { category: "crafts", subcategory: "plumber", craftName: "ignored" });
    expect(b.store).toMatchObject({ subcategory: "plumber", craftName: "" });
    const f = await mk("fam@t.com", { category: "families", subcategory: "plumber" });
    expect(f.store).toMatchObject({ category: "families", subcategory: null });
    expect((await mk("ev@t.com", { category: "events" })).status).toBe(201);
    const row = await prisma.store.findUnique({ where: { id: b.store.id } });
    expect(row?.searchText).toContain("سباك");
    expect(row?.searchText).toContain("plumber");
  });
});
