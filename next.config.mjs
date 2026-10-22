/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exposed to the browser so uploaders know whether to upload directly to Blob storage.
  env: { NEXT_PUBLIC_STORAGE_DRIVER: process.env.STORAGE_DRIVER === "vercel-blob" ? "vercel-blob" : "local" },
  // ffmpeg/ffprobe are external binaries; keep sharp native.
  serverExternalPackages: ["sharp"],
};
export default nextConfig;
