// Renders the brand logo (orange rounded square + cream pin with house) into the source images
// @capacitor/assets expects: icon-only, icon-foreground, icon-background, splash, splash-dark.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const out = path.resolve("assets");
fs.mkdirSync(out, { recursive: true });
const ORANGE = "#D4704A", CREAM = "#FBF3EA";
const pin = (fill, house) => `<path d="M256 96c-70 0-126 56-126 126 0 92 126 202 126 202s126-110 126-202c0-70-56-126-126-126z" fill="${fill}"/><path d="M256 168l-62 50v66h40v-40h44v40h40v-66z" fill="${house}"/>`;
const svg = (size, body, bg) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${bg ?? ""}${body}</svg>`);

// Legacy/full icon: the web logo as-is.
await sharp(svg(1024, pin(CREAM, ORANGE), `<rect width="512" height="512" rx="112" fill="${ORANGE}"/>`)).png().toFile(path.join(out, "icon-only.png"));
// Adaptive foreground: pin only, scaled into the 66% safe zone, transparent background.
await sharp(svg(1024, `<g transform="translate(256 256) scale(1.0) translate(-256 -260)">${pin(CREAM, ORANGE)}</g>`)).png().toFile(path.join(out, "icon-foreground.png"));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: ORANGE } }).png().toFile(path.join(out, "icon-background.png"));
// Splash: logo centered on cream (light) / dark brown (dark).
const splash = (bg) => sharp({ create: { width: 2732, height: 2732, channels: 4, background: bg } })
  .composite([{ input: svg(640, pin(CREAM, ORANGE), `<rect width="512" height="512" rx="112" fill="${ORANGE}"/>`), gravity: "center" }]).png();
await splash(CREAM).toFile(path.join(out, "splash.png"));
await splash("#2B1D16").toFile(path.join(out, "splash-dark.png"));
console.log("assets written to", out);
