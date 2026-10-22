"use client";
/** Downscales a photo to ≤ maxSide px and re-encodes it (WebP, JPEG fallback) before upload. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions).catch(() => createImageBitmap(file));
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality)))
      ?? (await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality)));
    if (!blob || (blob.size >= file.size && scale === 1 && ["image/jpeg", "image/png", "image/webp"].includes(file.type))) return file;
    const type = blob.type || "image/jpeg";
    return new File([blob], `photo.${type === "image/webp" ? "webp" : "jpg"}`, { type });
  } catch {
    return file;
  }
}
