// One-time admin bootstrap during build. Creates the admin only if that email doesn't exist yet
// (never overwrites an existing account/password). Needs BOOTSTRAP_ADMIN_EMAIL and
// BOOTSTRAP_ADMIN_PASSWORD_HASH_B64 (base64 of a bcrypt hash — never a plain password).
// Remove both env vars after the first successful deploy.
import { PrismaClient } from "@prisma/client";
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const b64 = process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH_B64;
if (!email || !b64) process.exit(0);
const hash = Buffer.from(b64, "base64").toString("utf8");
if (!/^\$2[aby]\$\d{2}\$/.test(hash)) { console.error("[bootstrap-admin] invalid hash; skipping"); process.exit(0); }
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) console.log("[bootstrap-admin] user already exists; no changes");
  else {
    await prisma.user.create({ data: { email, name: "Admin", password: hash, role: "ADMIN", emailVerified: new Date(), locale: "ar" } });
    console.log("[bootstrap-admin] admin created");
  }
} finally { await prisma.$disconnect(); }
