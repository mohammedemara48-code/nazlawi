import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { ApiError } from "../errors";
import type { Role } from "../constants";

export async function createUser(input: { name: string; email: string; password: string; role: Role; lang?: string }) {
  const { lang: _lang, ...data } = input;
  void _lang;
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new ApiError("EMAIL_TAKEN");
  const password = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({ data: { ...data, password } });
  return publicUser(user);
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always run a hash compare to reduce timing differences.
  const ok = await bcrypt.compare(password, user?.password ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) throw new ApiError("INVALID_CREDENTIALS");
  if (user.status !== "ACTIVE") throw new ApiError("ACCOUNT_SUSPENDED");
  return { ...publicUser(user), sv: user.sessionVersion };
}

export async function getUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id } });
  return u ? publicUser(u) : null;
}

function publicUser(u: { id: string; name: string; email: string; role: string; createdAt: Date; emailVerified: Date | null }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role as Role, emailVerified: !!u.emailVerified, createdAt: u.createdAt };
}
