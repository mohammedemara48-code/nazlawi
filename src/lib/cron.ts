import crypto from "node:crypto";
import { ApiError } from "./errors";

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Constant-time check; disabled when unset. */
export function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError("NOT_FOUND");
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) throw new ApiError("UNAUTHORIZED");
}
