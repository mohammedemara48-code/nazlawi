import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { ApiError } from "../errors";
import { storage } from "../storage";
import type { Locale } from "../constants";
import { sendEmailChange } from "./tokens";

async function userWithPassword(id: string, password: string) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new ApiError("UNAUTHORIZED");
  if (!(await bcrypt.compare(password, u.password))) throw new ApiError("WRONG_PASSWORD");
  return u;
}

export async function getAccount(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, locale: true, latitude: true, longitude: true, addressNote: true, role: true, emailVerified: true, createdAt: true },
  });
}

export async function updateProfile(id: string, data: { name?: string; phone?: string | null; locale?: string; latitude?: number | null; longitude?: number | null; addressNote?: string }) {
  return prisma.user.update({ where: { id }, data, select: { id: true, name: true, phone: true, locale: true, latitude: true, longitude: true, addressNote: true } });
}

/** Changes the password and bumps sessionVersion (signs out all other sessions). Returns the new version. */
export async function changePassword(id: string, currentPassword: string, newPassword: string) {
  await userWithPassword(id, currentPassword);
  const u = await prisma.user.update({
    where: { id },
    data: { password: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } },
  });
  return u;
}

export async function requestEmailChange(id: string, password: string, newEmail: string, lang: Locale) {
  const u = await userWithPassword(id, password);
  if (u.email === newEmail) throw new ApiError("SAME_EMAIL");
  if (await prisma.user.findUnique({ where: { email: newEmail } })) throw new ApiError("EMAIL_TAKEN");
  await sendEmailChange(u, newEmail, lang);
}

/** Deletes the account. Listings, images (rows + stored files) and tokens go with it. */
export async function deleteAccount(id: string, password: string) {
  const u = await userWithPassword(id, password);
  if (u.role === "ADMIN") {
    const others = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", id: { not: id } } });
    if (others === 0) throw new ApiError("LAST_ADMIN");
  }
  // Collect every stored file first; DB rows go via cascades (stores -> listings -> images/videos/promotions).
  const [images, stores, videos] = await Promise.all([
    prisma.listingImage.findMany({ where: { listing: { ownerId: id } }, select: { key: true } }),
    prisma.store.findMany({ where: { ownerId: id }, select: { logoKey: true, coverKey: true } }),
    prisma.video.findMany({ where: { ownerId: id }, select: { key: true, posterKey: true, sourceKey: true } }),
  ]);
  await prisma.user.delete({ where: { id } });
  const keys = [...images.map((i) => i.key), ...stores.flatMap((s) => [s.logoKey, s.coverKey]), ...videos.flatMap((v) => [v.key, v.posterKey, v.sourceKey])].filter(Boolean) as string[];
  await Promise.all(keys.map((k) => storage.delete(k).catch(() => {})));
}
