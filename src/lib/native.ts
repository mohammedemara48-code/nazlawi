/**
 * Bridge to the Capacitor Android shell (mobile/). The native app injects window.Capacitor into our pages and
 * appends "NazlawiApp/x" to the user agent. No @capacitor/* npm packages are needed in the web app: plugins are
 * reached through window.Capacitor.Plugins. Everything here is a no-op in normal browsers.
 */
type PushToken = { value: string };
type Listener = { remove: () => Promise<void> };
type PushPlugin = {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: "registration", cb: (t: PushToken) => void): Promise<Listener>;
  addListener(event: "registrationError", cb: (e: unknown) => void): Promise<Listener>;
  addListener(event: "pushNotificationActionPerformed", cb: (a: { notification: { data?: Record<string, string> } }) => void): Promise<Listener>;
};
type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: { PushNotifications?: PushPlugin } };

export const capacitor = (): Cap | null => (typeof window !== "undefined" ? ((window as unknown as { Capacitor?: Cap }).Capacitor ?? null) : null);
export const isNativeApp = () => !!capacitor()?.isNativePlatform?.() || (typeof navigator !== "undefined" && /NazlawiApp\//.test(navigator.userAgent));

/**
 * Push notifications hook (Firebase Cloud Messaging via @capacitor/push-notifications).
 * Disabled until a Firebase project exists: set NEXT_PUBLIC_PUSH_ENABLED=1 AND ship the app with
 * android/app/google-services.json (see ANDROID.md). Calling register() without Firebase config crashes the app,
 * so both are required.
 * onToken: send the FCM token to the server (TODO: POST /api/me/push-tokens once the backend side exists).
 */
export async function initPush(opts: { onToken: (token: string) => void; onOpen?: (data: Record<string, string>) => void }) {
  if (process.env.NEXT_PUBLIC_PUSH_ENABLED !== "1") return false;
  const push = capacitor()?.Plugins?.PushNotifications;
  if (!push || !isNativeApp()) return false;
  let perm = await push.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await push.requestPermissions();
  if (perm.receive !== "granted") return false;
  await push.addListener("registration", (t) => opts.onToken(t.value));
  await push.addListener("registrationError", (e) => console.warn("[push] registration failed", e));
  if (opts.onOpen) await push.addListener("pushNotificationActionPerformed", (a) => opts.onOpen!(a.notification.data ?? {}));
  await push.register();
  return true;
}
