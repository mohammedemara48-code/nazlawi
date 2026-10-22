/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";
// CSP: self + OSM tiles (Leaflet), Vercel Blob direct uploads, Vercel Live toolbar on previews. Links (wa.me, Google Maps) are navigations, not fetches.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.public.blob.vercel-storage.com https://vercel.live https://vercel.com",
  "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data: https://vercel.live",
  "connect-src 'self' https://vercel.com https://*.vercel-storage.com https://*.blob.vercel-storage.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src 'self' https://vercel.live",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
];
const nextConfig = {
  poweredByHeader: false,
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
  reactStrictMode: true,
  // Separate build dir for the smoke suite so it never clobbers a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Exposed to the browser so uploaders know whether to upload directly to Blob storage.
  env: { NEXT_PUBLIC_BLOB_ACCESS: process.env.BLOB_ACCESS === "public" ? "public" : "private", NEXT_PUBLIC_STORAGE_DRIVER: process.env.STORAGE_DRIVER === "vercel-blob" ? "vercel-blob" : "local" },
  // ffmpeg/ffprobe are external binaries; keep sharp native.
  serverExternalPackages: ["sharp"],
};
export default nextConfig;
