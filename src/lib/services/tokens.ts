import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { ApiError } from "../errors";
import { mailer } from "../mailer";
import type { Locale } from "../constants";
import { siteUrl } from "../site";

export type TokenType = "VERIFY_EMAIL" | "RESET_PASSWORD" | "CHANGE_EMAIL";
const TTL: Record<TokenType, number> = { VERIFY_EMAIL: 24 * 3600_000, RESET_PASSWORD: 30 * 60_000, CHANGE_EMAIL: 24 * 3600_000 };
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const appUrl = siteUrl;
const prefix = (l: Locale) => (l === "en" ? "/en" : "");

/** Creates a new token (invalidating older unused ones of the same type). Returns the raw token. */
export async function issueToken(userId: string, type: TokenType, data?: string) {
  const raw = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({ data: { userId, type, data, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + TTL[type]) } }),
  ]);
  return raw;
}

/** Atomically consumes a token; throws TOKEN_INVALID if missing, used, expired or wrong type. */
async function consume(raw: string, type: TokenType) {
  const t = await prisma.authToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!t || t.type !== type || t.usedAt || t.expiresAt < new Date()) throw new ApiError("TOKEN_INVALID");
  const { count } = await prisma.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  if (count !== 1) throw new ApiError("TOKEN_INVALID"); // lost a race: single use
  return t;
}

export async function sendVerification(user: { id: string; email: string; name: string }, lang: Locale) {
  const raw = await issueToken(user.id, "VERIFY_EMAIL");
  const link = `${appUrl()}${prefix(lang)}/verify?token=${raw}`;
  return (await mailer.send(
    lang === "en"
      ? { to: user.email, subject: "Confirm your Nazlawi email", text: `Hi ${user.name},\n\nConfirm your email by opening this link (valid 24 hours):\n${link}\n` }
      : { to: user.email, subject: "تأكيد بريدك الإلكتروني في نزلاوي", text: `أهلاً ${user.name}،\n\nأكّد بريدك الإلكتروني بفتح الرابط ده (صالح 24 ساعة):\n${link}\n` },
  )) !== false;
}

export async function verifyEmail(raw: string) {
  const t = await consume(raw, "VERIFY_EMAIL");
  await prisma.user.update({ where: { id: t.userId }, data: { emailVerified: new Date() } });
}

/** Always resolves (no user enumeration). */
export async function requestPasswordReset(email: string, lang: Locale) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const raw = await issueToken(user.id, "RESET_PASSWORD");
  const link = `${appUrl()}${prefix(lang)}/reset-password?token=${raw}`;
  await mailer.send(
    lang === "en"
      ? { to: email, subject: "Reset your Nazlawi password", text: `Someone asked to reset your password. Open this link within 30 minutes:\n${link}\n\nIf it wasn't you, ignore this email.` }
      : { to: email, subject: "إعادة تعيين كلمة المرور في نزلاوي", text: `حد طلب إعادة تعيين كلمة المرور بتاعتك. افتح الرابط ده خلال 30 دقيقة:\n${link}\n\nلو مش إنت، تجاهل الرسالة.` },
  );
}

export async function resetPassword(raw: string, password: string) {
  const t = await consume(raw, "RESET_PASSWORD");
  await prisma.$transaction([
    // Completing a reset proves ownership of the inbox, so the email counts as verified.
    // Also bump sessionVersion: a reset signs out every existing session.
    prisma.user.update({ where: { id: t.userId }, data: { password: await bcrypt.hash(password, 12), emailVerified: new Date(), sessionVersion: { increment: 1 } } }),
    prisma.authToken.updateMany({ where: { userId: t.userId, type: "RESET_PASSWORD", usedAt: null }, data: { usedAt: new Date() } }),
  ]);
}

export async function sendEmailChange(user: { id: string; name: string }, newEmail: string, lang: Locale) {
  const raw = await issueToken(user.id, "CHANGE_EMAIL", newEmail);
  const link = `${appUrl()}${prefix(lang)}/confirm-email?token=${raw}`;
  await mailer.send(
    lang === "en"
      ? { to: newEmail, subject: "Confirm your new Nazlawi email", text: `Hi ${user.name},\n\nOpen this link to make this your Nazlawi email (valid 24 hours):\n${link}\n\nIf you didn't ask for this, ignore this email.` }
      : { to: newEmail, subject: "تأكيد بريدك الجديد في نزلاوي", text: `أهلاً ${user.name}،\n\nافتح الرابط ده علشان يبقى ده بريدك في نزلاوي (صالح 24 ساعة):\n${link}\n\nلو مش إنت اللي طلبت، تجاهل الرسالة.` },
  );
}

/** Switches the email only after the new address confirms; re-checks that it's still free. */
export async function confirmEmailChange(raw: string) {
  const t = await consume(raw, "CHANGE_EMAIL");
  if (!t.data) throw new ApiError("TOKEN_INVALID");
  const taken = await prisma.user.findUnique({ where: { email: t.data } });
  if (taken && taken.id !== t.userId) throw new ApiError("EMAIL_TAKEN");
  await prisma.user.update({ where: { id: t.userId }, data: { email: t.data, emailVerified: new Date() } });
}
