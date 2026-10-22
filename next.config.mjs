/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Separate build dir for the smoke suite so it never clobbers a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Exposed to the browser so uploaders know whether to upload directly to Blob storage.
  env: { NEXT_PUBLIC_BLOB_ACCESS: process.env.BLOB_ACCESS === "public" ? "public" : "private", NEXT_PUBLIC_STORAGE_DRIVER: process.env.STORAGE_DRIVER === "vercel-blob" ? "vercel-blob" : "local" },
  // ffmpeg/ffprobe are external binaries; keep sharp native.
  serverExternalPackages: ["sharp"],
};
export default nextConfig;
