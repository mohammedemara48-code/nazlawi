/** Canonical public origin (no trailing slash) for metadata, sitemap and JSON-LD. */
export const siteUrl = () =>
  (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100")).replace(/\/$/, "");
export const abs = (path: string) => (/^https?:/.test(path) ? path : `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`);
/** Serialize JSON-LD safely inside a <script> tag. */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
