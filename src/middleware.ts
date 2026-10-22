import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/constants";

// Arabic is served at "/" (internally rewritten to /ar/...), English at "/en/...".
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    return NextResponse.redirect(new URL((pathname.slice(3) || "/") + search, req.url));
  }
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const rest = isEn ? pathname.slice(3) || "/" : pathname;

  // Protected areas: redirect to sign-in if there is no valid session.
  if (rest.startsWith("/dashboard") || rest.startsWith("/admin") || rest.startsWith("/settings") || rest.startsWith("/onboarding")) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    let ok = false;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET!));
        ok = !rest.startsWith("/admin") || payload.role === "ADMIN";
      } catch {}
    }
    if (!ok) {
      const url = new URL((isEn ? "/en" : "") + "/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  const headers = new Headers(req.headers);
  headers.set("x-nz-lang", isEn ? "en" : "ar"); // used by not-found.tsx
  if (isEn) return NextResponse.next({ request: { headers } });
  return NextResponse.rewrite(new URL(`/ar${pathname === "/" ? "" : pathname}${search}`, req.url), { request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next|icons|icon|apple-icon|favicon|manifest|sw.js|village-hero|offline.html|.*\\..*).*)"],
};
