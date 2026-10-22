import fs from "node:fs";
import path from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The app is a native shell around the server-rendered Next.js site.
 *
 *  CAP_SERVER_URL  URL the WebView loads. Default: the production placeholder below (change it when the domain exists).
 *  CAP_MODE=dev    Development: loads the box/laptop dev server over plain HTTP
 *                  (default http://10.0.2.2:3100 = the host machine as seen from the Android emulator).
 *
 * Read at `cap sync` time and baked into android/app/src/main/assets/capacitor.config.json.
 */
const PROD_URL = "https://nazlawi.example.com"; // TODO: replace with the real production domain
const dev = process.env.CAP_MODE === "dev";
const serverUrl = (process.env.CAP_SERVER_URL || (dev ? "http://10.0.2.2:3100" : PROD_URL)).replace(/\/$/, "");
const host = new URL(serverUrl).hostname;

// Lets the bundled offline page know where to retry.
fs.writeFileSync(path.join(__dirname, "www", "app-config.js"), `window.NAZLAWI_SERVER_URL = ${JSON.stringify(serverUrl)};\n`);

const config: CapacitorConfig = {
  appId: "com.nazlawi.app",
  appName: "نزلاوي",
  webDir: "www",
  server: {
    url: serverUrl,
    // Shown when the server can't be reached (no network, DNS, TLS…). Bundled in the APK.
    errorPath: "offline.html",
    cleartext: serverUrl.startsWith("http://"),
    // Only our own host is loaded inside the app; everything else (WhatsApp, maps, tel:, other sites) opens externally.
    allowNavigation: [host],
    androidScheme: "https",
  },
  android: {
    appendUserAgent: "NazlawiApp/1.0",
    backgroundColor: "#FBF3EA",
    allowMixedContent: dev,
    webContentsDebuggingEnabled: dev,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#FBF3EA",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
    },
    // Capacitor 8 edge-to-edge handling (Android 15+ always draws behind the system bars):
    // the WebView is padded below the status bar; MainActivity paints that area brand orange.
    SystemBars: {
      insetsHandling: "native",
      style: "DARK",
    },
    // Android < 15: classic colored status bar.
    StatusBar: {
      backgroundColor: "#D4704A",
      style: "DARK", // light text/icons on the orange bar
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
