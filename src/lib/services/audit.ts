import { prisma } from "../db";
import type { Session } from "../session";

export async function audit(actor: Session, action: string, targetType: "USER" | "LISTING" | "STORE" | "VIDEO" | "PROMOTION", targetId: string, meta: Record<string, unknown> = {}) {
  const a = await prisma.user.findUnique({ where: { id: actor.sub }, select: { email: true } });
  await prisma.auditLog.create({ data: { actorId: actor.sub, actorEmail: a?.email ?? "?", action, targetType, targetId, meta: JSON.stringify(meta) } });
}

export async function listAudit(page: number, pageSize: number) {
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count(),
  ]);
  return { items: items.map((i) => ({ ...i, meta: JSON.parse(i.meta) as Record<string, unknown> })), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
