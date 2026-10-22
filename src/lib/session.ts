import { SignJWT, jwtVerify } from "jose";
import { SESSION_COOKIE, type Role } from "./constants";
import { ApiError } from "./errors";
import { prisma } from "./db";

/** sv = session version; bumping User.sessionVersion invalidates every older token. */
export type Session = { sub: string; role: Role; name: string; sv?: number };
const MAX_AGE = 60 * 60 * 24 * 30;

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session) {
  return new SignJWT({ role: s.role, name: s.name, sv: s.sv ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

/** Verifies the JWT signature only (no DB). Used by middleware-like fast paths. */
export async function verifyToken(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { sub: payload.sub!, role: payload.role as Role, name: String(payload.name ?? ""), sv: Number(payload.sv ?? 0) };
  } catch {
    return null;
  }
}

/**
 * Full check: valid signature AND the user still exists, is ACTIVE, and the session
 * version matches. Role/name come from the DB so admin changes apply immediately.
 */
export async function verifySession(token?: string | null): Promise<Session | null> {
  const t = await verifyToken(token);
  if (!t) return null;
  const u = await prisma.user.findUnique({ where: { id: t.sub }, select: { role: true, name: true, status: true, sessionVersion: true } });
  if (!u || u.status !== "ACTIVE" || u.sessionVersion !== (t.sv ?? 0)) return null;
  return { sub: t.sub, role: u.role as Role, name: u.name, sv: u.sessionVersion };
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}
export const clearCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

function readCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function getRequestSession(req: Request) {
  return verifySession(readCookie(req, SESSION_COOKIE));
}

export async function requireSession(req: Request, roles?: Role[]) {
  const s = await getRequestSession(req);
  if (!s) throw new ApiError("UNAUTHORIZED");
  if (roles && !roles.includes(s.role)) throw new ApiError("FORBIDDEN");
  return s;
}
