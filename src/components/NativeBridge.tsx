"use client";
import { useEffect } from "react";
import { initPush, isNativeApp } from "@/lib/native";

/** Runs inside the Android app only: marks <html> for app-specific styling and starts push (when enabled). */
export default function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("native-app");
    void initPush({
      onToken: (token) => console.info("[push] FCM token ready", token.slice(0, 12) + "…"), // TODO: send to the server
      onOpen: (data) => { if (data.url && data.url.startsWith("/")) window.location.href = data.url; },
    }).catch(() => {});
  }, []);
  return null;
}
