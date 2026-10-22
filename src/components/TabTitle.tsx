"use client";
import { useEffect } from "react";
/** not-found.tsx can't export dynamic metadata, so set the localized tab title on the client. */
export default function TabTitle({ title }: { title: string }) {
  useEffect(() => { document.title = title; }, [title]);
  return null;
}
