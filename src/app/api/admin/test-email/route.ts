import { NextResponse } from "next/server";
import { api } from "@/lib/errors";
import { requireSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { sendTestEmail } from "@/lib/mailer";

/** Admin: send one test email to the configured sender inbox (verifies SMTP/Resend settings). */
export const POST = api(async (req) => {
  const s = await requireSession(req, ["ADMIN"]);
  await rateLimit(`test-email:${s.sub}`, 5, 60 * 60_000);
  try {
    return NextResponse.json(await sendTestEmail());
  } catch (e) {
    const err = e as { code?: string; responseCode?: number };
    console.error("[mail] test email failed", err.code, err.responseCode);
    return NextResponse.json({ sent: false, reason: "DELIVERY_FAILED", code: err.code ?? null, responseCode: err.responseCode ?? null }, { status: 502 });
  }
});
