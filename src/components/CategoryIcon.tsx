const ICONS: Record<string, string> = {
  groceries: "M3 9h18l-2 10H5L3 9zm4 0l3-5m7 5l-3-5M9 13v3m6-3v3",
  clothing: "M8 3l-5 3 2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 01-8 0z",
  construction: "M14 4l6 6-3 3-6-6 3-3zM11 7L3 15l3 3 8-8",
  rides: "M5 17h14M6 17V9l2-4h8l2 4v8M6 13h12M8 17v2m8-2v2",
  transport: "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z",
  medical: "M12 21s-8-5-8-11a4 4 0 018-2 4 4 0 018 2c0 6-8 11-8 11zM12 9v5m-2.5-2.5h5",
};
export default function CategoryIcon({ name, className = "h-8 w-8" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}
