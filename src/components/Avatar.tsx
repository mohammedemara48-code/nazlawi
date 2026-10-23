/** Round profile photo, or the first letter of the name on the brand colour. */
export default function Avatar({ k, name, size = "h-10 w-10" }: { k: string | null | undefined; name: string; size?: string }) {
  return k ? <img src={`/api/uploads/${k}`} alt="" className={`${size} shrink-0 rounded-full object-cover`} loading="lazy" />
    : <span aria-hidden className={`${size} flex shrink-0 items-center justify-center rounded-full bg-[#C0532F] font-bold text-white`}>{name.trim().slice(0, 1) || "?"}</span>;
}
