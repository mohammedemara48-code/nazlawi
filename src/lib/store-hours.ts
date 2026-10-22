/** Opening hours helpers (Africa/Cairo). Times are "HH:MM"; close < open means it closes after midnight. */
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export function cairoMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}
/** null when hours aren't set. */
export function isOpenAt(open: string | null | undefined, close: string | null | undefined, minutes: number): boolean | null {
  if (!open || !close) return null;
  const o = toMin(open), c = toMin(close);
  if (o === c) return true; // 24h
  return o < c ? minutes >= o && minutes < c : minutes >= o || minutes < c;
}
/** Prefilled WhatsApp order link (opens externally). */
export function waOrderLink(number: string, text: string) {
  const n = number.replace(/[^\d]/g, "").replace(/^0(?=1)/, "20");
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
