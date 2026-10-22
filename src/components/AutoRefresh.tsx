"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Re-renders the server page every few seconds while something (e.g. a video) is processing. */
export default function AutoRefresh({ active, ms = 5000 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [active, ms, router]);
  return null;
}
