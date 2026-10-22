// Admin bootstrap during build (BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD_HASH_B64 = base64 of a bcrypt hash;
// never a plain password).
//  - Creates the admin if that email doesn't exist yet.
//  - With BOOTSTRAP_ADMIN_RESET=1 it also resets the password of an EXISTING admin (only role ADMIN), bumps
//    sessionVersion (signs out every old session) and writes an audit entry. Idempotent: same hash → no change.
// Remove all BOOTSTRAP_ADMIN_* env vars after the deploy.
import { PrismaClient } from "@prisma/client";
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const b64 = process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH_B64;
const reset = process.env.BOOTSTRAP_ADMIN_RESET === "1";
if (!email || !b64) process.exit(0);
const hash = Buffer.from(b64, "base64").toString("utf8");
if (!/^\$2[aby]\$\d{2}\$/.test(hash)) { console.error("[bootstrap-admin] invalid hash; skipping"); process.exit(0); }
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({ data: { email, name: "Admin", password: hash, role: "ADMIN", emailVerified: new Date(), locale: "ar" } });
    console.log("[bootstrap-admin] admin created");
  } else if (!reset) console.log("[bootstrap-admin] user already exists; no changes");
  else if (existing.role !== "ADMIN") console.error("[bootstrap-admin] reset refused: account is not an admin");
  else if (existing.password === hash) console.log("[bootstrap-admin] password already set; no changes");
  else {
    await prisma.$transaction([
      prisma.user.update({ where: { id: existing.id }, data: { password: hash, sessionVersion: { increment: 1 }, status: "ACTIVE" } }),
      prisma.authToken.deleteMany({ where: { userId: existing.id } }),
      prisma.auditLog.create({ data: { actorId: existing.id, actorEmail: existing.email, action: "ADMIN_PASSWORD_RESET", targetType: "USER", targetId: existing.id, meta: JSON.stringify({ via: "build-bootstrap" }) } }),
    ]);
    console.log("[bootstrap-admin] admin password reset; old sessions signed out");
  }
} finally { await prisma.$disconnect(); }
