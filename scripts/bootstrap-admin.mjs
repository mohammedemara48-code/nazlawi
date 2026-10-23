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
const renameFrom = process.env.BOOTSTRAP_ADMIN_EMAIL_FROM?.trim().toLowerCase();
// Email-change mode (BOOTSTRAP_ADMIN_EMAIL_FROM=old, BOOTSTRAP_ADMIN_EMAIL=new): renames an existing ADMIN's email,
// keeps the password, writes an audit entry. Refuses if the new email is taken. Idempotent.
if (email && renameFrom && renameFrom !== email) {
  const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  try {
    const [from, taken] = await Promise.all([db.user.findUnique({ where: { email: renameFrom } }), db.user.findUnique({ where: { email } })]);
    if (taken) console.log(taken.role === "ADMIN" && !from ? "[bootstrap-admin] admin email already changed; no changes" : "[bootstrap-admin] email change refused: new email already in use");
    else if (!from || from.role !== "ADMIN") console.error("[bootstrap-admin] email change refused: old email is not an admin");
    else {
      await db.$transaction([
        db.user.update({ where: { id: from.id }, data: { email, emailVerified: new Date() } }),
        db.authToken.deleteMany({ where: { userId: from.id, type: "CHANGE_EMAIL" } }),
        db.auditLog.create({ data: { actorId: from.id, actorEmail: email, action: "ADMIN_EMAIL_CHANGED", targetType: "USER", targetId: from.id, meta: JSON.stringify({ from: renameFrom, to: email, via: "build-bootstrap" }) } }),
      ]);
      console.log("[bootstrap-admin] admin email changed");
    }
  } finally { await db.$disconnect(); }
  process.exit(0);
}
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
