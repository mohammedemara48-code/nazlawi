const ICONS: Record<string, string> = {
  groceries: "M3 9h18l-2 10H5L3 9zm4 0l3-5m7 5l-3-5M9 13v3m6-3v3",
  clothing: "M8 3l-5 3 2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 01-8 0z",
  construction: "M14 4l6 6-3 3-6-6 3-3zM11 7L3 15l3 3 8-8",
  rides: "M5 17h14M6 17V9l2-4h8l2 4v8M6 13h12M8 17v2m8-2v2",
  transport: "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z",
  medical: "M12 21s-8-5-8-11a4 4 0 018-2 4 4 0 018 2c0 6-8 11-8 11zM12 9v5m-2.5-2.5h5",
  crafts: "M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z",
  families: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9zM12 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3",
  events: "M12 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.2l5-.7L12 3zM5 21h14",
  invitations: "M3 8l9 6 9-6M4 6h16a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zm8-3v3",
};
export default function CategoryIcon({ name, className = "h-8 w-8" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}
