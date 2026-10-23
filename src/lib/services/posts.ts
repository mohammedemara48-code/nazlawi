import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../errors";
import { storage } from "../storage";
import type { Session } from "../session";
import { POSTS_PAGE_SIZE } from "../constants";
import { audit } from "./audit";
import { storeImage, type UploadInput } from "./media";

/**
 * Event invitations timeline (دعوات المناسبات).
 * - Residents (and admins) post one image + caption. Service providers can like/comment but not post.
 * - Any signed-in active user can like and comment.
 * - Authors delete their own posts/comments; admins delete anything. Deletion is permanent (rows + image file).
 */
const AUTHOR = { select: { id: true, name: true, avatarKey: true } } as const;
const ACTIVE_AUTHOR: Prisma.PostWhereInput = { author: { status: "ACTIVE" } };

export const canPost = (role: string) => role === "RESIDENT" || role === "ADMIN";

export async function createPost(s: Session, file: UploadInput, caption: string) {
  if (!canPost(s.role)) throw new ApiError("POST_RESIDENTS_ONLY");
  const img = await storeImage(file, `posts/${s.sub}`, { width: 1200, height: 1500, fit: "inside" });
  try {
    return await prisma.post.create({ data: { authorId: s.sub, imageKey: img.key, width: img.width, height: img.height, caption }, include: { author: AUTHOR } });
  } catch (e) {
    await storage.delete(img.key).catch(() => {});
    throw e;
  }
}

export async function listPosts(opts: { page?: number; pageSize?: number; authorId?: string; viewerId?: string | null } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? POSTS_PAGE_SIZE;
  const where: Prisma.PostWhereInput = { ...ACTIVE_AUTHOR, ...(opts.authorId ? { authorId: opts.authorId } : {}) };
  const [rows, total] = await prisma.$transaction([
    prisma.post.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      include: {
        author: AUTHOR,
        _count: { select: { likes: true, comments: true } },
        likes: opts.viewerId ? { where: { userId: opts.viewerId }, select: { userId: true } } : false,
        comments: { where: { author: { status: "ACTIVE" } }, orderBy: { createdAt: "asc" }, take: 50, include: { author: AUTHOR } },
      },
    }),
    prisma.post.count({ where }),
  ]);
  const items = rows.map(({ likes, _count, ...p }) => ({ ...p, likeCount: _count.likes, commentCount: _count.comments, liked: Array.isArray(likes) && likes.length > 0 }));
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
export type TimelinePost = Awaited<ReturnType<typeof listPosts>>["items"][number];

async function findPost(id: string) {
  const p = await prisma.post.findFirst({ where: { id, ...ACTIVE_AUTHOR } });
  if (!p) throw new ApiError("NOT_FOUND");
  return p;
}

export async function deletePost(id: string, s: Session) {
  const p = await prisma.post.findUnique({ where: { id } });
  if (!p) throw new ApiError("NOT_FOUND");
  if (p.authorId !== s.sub && s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
  await prisma.post.delete({ where: { id } });
  await storage.delete(p.imageKey).catch(() => {});
  if (s.role === "ADMIN" && p.authorId !== s.sub) await audit(s, "POST_DELETED", "POST", id, { authorId: p.authorId, caption: p.caption.slice(0, 80) });
}

/** Toggles the viewer's like. Returns the new state and count. */
export async function toggleLike(postId: string, s: Session) {
  await findPost(postId);
  const key = { postId_userId: { postId, userId: s.sub } };
  const existing = await prisma.postLike.findUnique({ where: key });
  if (existing) await prisma.postLike.delete({ where: key });
  else await prisma.postLike.create({ data: { postId, userId: s.sub } }).catch((e) => { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; });
  const count = await prisma.postLike.count({ where: { postId } });
  return { liked: !existing, count };
}

export async function addComment(postId: string, body: string, s: Session) {
  await findPost(postId);
  return prisma.postComment.create({ data: { postId, authorId: s.sub, body }, include: { author: AUTHOR } });
}

export async function deleteComment(id: string, s: Session) {
  const c = await prisma.postComment.findUnique({ where: { id } });
  if (!c) throw new ApiError("NOT_FOUND");
  if (c.authorId !== s.sub && s.role !== "ADMIN") throw new ApiError("FORBIDDEN");
  await prisma.postComment.delete({ where: { id } });
  if (s.role === "ADMIN" && c.authorId !== s.sub) await audit(s, "COMMENT_DELETED", "COMMENT", id, { postId: c.postId, authorId: c.authorId, body: c.body.slice(0, 80) });
}

export async function report(input: { postId?: string; commentId?: string; reason: string }, s: Session) {
  if (input.postId) await findPost(input.postId);
  else if (!(await prisma.postComment.findUnique({ where: { id: input.commentId! }, select: { id: true } }))) throw new ApiError("NOT_FOUND");
  try {
    return await prisma.postReport.create({ data: { reporterId: s.sub, postId: input.postId ?? null, commentId: input.commentId ?? null, reason: input.reason } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ApiError("ALREADY_REPORTED");
    throw e;
  }
}

/** Admin: open reports grouped by target, newest first. */
export async function listReports() {
  const rows = await prisma.postReport.findMany({
    orderBy: { createdAt: "desc" }, take: 200,
    include: {
      reporter: { select: { name: true, email: true } },
      post: { include: { author: { select: { id: true, name: true, email: true } } } },
      comment: { include: { author: { select: { id: true, name: true, email: true } } } },
    },
  });
  const groups = new Map<string, { key: string; type: "POST" | "COMMENT"; post: (typeof rows)[number]["post"]; comment: (typeof rows)[number]["comment"]; reports: typeof rows }>();
  for (const r of rows) {
    const key = r.postId ? `p:${r.postId}` : `c:${r.commentId}`;
    const g = groups.get(key) ?? { key, type: r.postId ? "POST" as const : "COMMENT" as const, post: r.post, comment: r.comment, reports: [] };
    g.reports.push(r);
    groups.set(key, g);
  }
  return [...groups.values()];
}
export const openReportCount = () => prisma.postReport.count();

/** Admin: keep the content and clear its reports. */
export async function dismissReports(target: { postId?: string; commentId?: string }) {
  await prisma.postReport.deleteMany({ where: target.postId ? { postId: target.postId } : { commentId: target.commentId } });
}

/** Profile photo (400x400 WebP). */
export async function setAvatar(s: Session, file: UploadInput) {
  const cur = await prisma.user.findUnique({ where: { id: s.sub }, select: { avatarKey: true } });
  if (!cur) throw new ApiError("UNAUTHORIZED");
  const img = await storeImage(file, `avatars/${s.sub}`, { width: 400, height: 400, fit: "cover" });
  const u = await prisma.user.update({ where: { id: s.sub }, data: { avatarKey: img.key }, select: { id: true, avatarKey: true } });
  if (cur.avatarKey) await storage.delete(cur.avatarKey).catch(() => {});
  return u;
}
export async function removeAvatar(s: Session) {
  const cur = await prisma.user.findUnique({ where: { id: s.sub }, select: { avatarKey: true } });
  if (cur?.avatarKey) {
    await prisma.user.update({ where: { id: s.sub }, data: { avatarKey: null } });
    await storage.delete(cur.avatarKey).catch(() => {});
  }
}

export async function publicProfile(id: string) {
  return prisma.user.findFirst({ where: { id, status: "ACTIVE" }, select: { id: true, name: true, avatarKey: true, role: true, createdAt: true, _count: { select: { posts: true } } } });
}
