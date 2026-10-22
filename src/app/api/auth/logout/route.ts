import { NextResponse } from "next/server";
import { clearCookie } from "@/lib/session";
export const POST = async () => NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearCookie } });
