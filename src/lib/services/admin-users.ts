import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../errors";
import type { Session } from "../session";
import type { Role, UserStatus } from "../constants";
import { audit } from "./audit";
import { sendVerification } from "./tokens";
import type { Locale } from "../constants";

export async function listUsers(q: { q?: string; role?: Role; status?: UserStatus; page: number; pageSize: number }) {
  const where: Prisma.UserWhereInput = {};
  if (q.role) where.role = q.role;
  if (q.status) where.status = q.status;
  if (q.q) where.OR = [{ name: { contains: q.q } }, { email: { contains: q.q.toLowerCase() } }];
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: { id: true, name: true, email: true, role: true, status: true, emailVerified: true, createdAt: true, _count: { select: { listings: true, stores: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items: items.map(({ _count, emailVerified, ...u }) => ({ ...u, verified: !!emailVerified, listingCount: _count.listings, storeCount: _count.stores })),
    page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export async function updateUser(admin: Session, id: string, change: { role?: Role; status?: UserStatus }) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ApiError("NOT_FOUND");
  const demoting = change.role && change.role !== "ADMIN" && target.role === "ADMIN";
  const suspending = change.status === "SUSPENDED" && target.status !== "SUSPENDED";
  if (id === admin.sub && (demoting || suspending)) throw new ApiError("CANNOT_MODIFY_SELF");
  if ((demoting || suspending) && target.role === "ADMIN" && target.status === "ACTIVE") {
    const others = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", id: { not: id } } });
    if (others === 0) throw new ApiError("LAST_ADMIN");
  }
  const data: Prisma.UserUpdateInput = {};
  if (change.role && change.role !== target.role) data.role = change.role;
  if (change.status && change.status !== target.status) {
    data.status = change.status;
    // Suspension kills existing sessions immediately.
    if (change.status === "SUSPENDED") data.sessionVersion = { increment: 1 };
  }
  const updated = await prisma.user.update({ where: { id }, data, select: { id: true, role: true, status: true } });
  if (data.role) await audit(admin, "USER_ROLE_CHANGED", "USER", id, { email: target.email, from: target.role, to: change.role });
  if (data.status) await audit(admin, change.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_UNSUSPENDED", "USER", id, { email: target.email });
  return updated;
}

export async function adminResendVerification(admin: Session, id: string, lang: Locale) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new ApiError("NOT_FOUND");
  if (!u.emailVerified) await sendVerification(u, (u.locale as Locale) || lang);
  await audit(admin, "USER_VERIFICATION_RESENT", "USER", id, { email: u.email, alreadyVerified: !!u.emailVerified });
  return { sent: !u.emailVerified };
}
