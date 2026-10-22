# تطبيق أندرويد / Android app

تطبيق «نزلاوي» على أندرويد هو غلاف أصلي (Capacitor 8) يفتح موقع نزلاوي من السيرفر، لأن الموقع Next.js بيتعرض من السيرفر (Server-rendered).
The Android app is a native **Capacitor 8** shell that loads the server-rendered Next.js site from a configurable URL.

> الحالة: تم بناء APK للتجربة (debug). لم يتم إنشاء حساب Google Play أو Firebase. لم يُختبر على جهاز/محاكي بعد.
> Status: a debug APK builds. No Play Console or Firebase accounts exist. Not yet tested on a device/emulator.

## البنية / Layout
```
mobile/
  capacitor.config.ts      app id com.nazlawi.app, name «نزلاوي», server URL, splash/status bar/push config
  www/offline.html         bundled offline page (ar/en) shown when the server can't be reached
  www/index.html           fallback that redirects to the server URL
  scripts/make-assets.mjs  renders the logo into icon/splash sources (assets/)
  android/                 the Android Studio / Gradle project
    app/src/main/java/com/nazlawi/app/MainActivity.java   back button, pull-to-refresh, status-bar color
```
The web app needs no Capacitor packages: Capacitor injects `window.Capacitor` into our pages, and the app adds `NazlawiApp/1.0` to the user agent (`src/lib/native.ts`, `src/components/NativeBridge.tsx`).

## الخصائص / Features
| Feature | How |
|---|---|
| Server URL | `CAP_SERVER_URL` at `cap sync` time; default `https://nazlawi-bwfg-waslapp.vercel.app` (`PROD_URL` in `capacitor.config.ts`) |
| Dev mode | `CAP_MODE=dev` → `http://10.0.2.2:3100` (the host machine from the Android emulator), cleartext + WebView debugging enabled |
| Icon | adaptive icon (orange background + cream pin/house), round + monochrome (themed icons), legacy PNGs |
| Splash | Android 12+ splash API (cream + logo) and Capacitor splash (light/dark) |
| RTL | `android:supportsRtl="true"`; pages set `dir` per language |
| Status bar | brand orange `#D4704A` with light icons (Android ≤14 via theme/StatusBar; Android 15+ edge-to-edge: WebView padded, orange behind the bar) |
| Back button | goes back in web history; on the first page it leaves the app |
| Offline | `server.errorPath` → bundled `offline.html` with Retry + auto-retry when the connection returns |
| External links | only our host loads inside the app; `tel:`, `wa.me`/WhatsApp, Google Maps/`geo:`, mailto and other sites open in their apps (Android 11 `<queries>` declared) |
| Uploads | `<input type=file>` opens the system picker (gallery/files); the "📷 Camera" buttons (phones) use `capture` to open the camera. `CAMERA` permission is requested at runtime |
| Pull-to-refresh | `SwipeRefreshLayout` around the WebView (only when the page is scrolled to the top) |
| Push (later) | `@capacitor/push-notifications` installed; see "Firebase push" below |

## المتطلبات / Requirements
- Node **22+** (Capacitor CLI 8). The web app itself still works with Node 20.
- JDK **21**, Android SDK (platform 36, build-tools 36, platform-tools). Android Studio is optional.
- On the dev box these are installed at: JDK `/usr/lib/jvm/java-21-openjdk-amd64`, SDK `~/android-sdk`, Node 22 `~/node22/bin`.

```bash
export ANDROID_HOME=$HOME/android-sdk
export PATH=$HOME/node22/bin:$PATH
cd mobile
npm install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties   # once
```

## البناء / Build
```bash
# Debug APK for the production URL (placeholder until the domain exists)
CAP_SERVER_URL=https://your-domain npm run apk:debug
# Debug APK for the dev server (emulator → host :3100)
npm run apk:debug:dev
# Or a real phone on the same Wi-Fi as your laptop:
CAP_MODE=dev CAP_SERVER_URL=http://192.168.1.20:3100 npm run apk:debug
```
Output: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Install: `adb install -r app-debug.apk` (or copy to the phone and open it; allow "install unknown apps").

Regenerate icons/splash after changing the logo: `npm run assets` (then `npm run sync`).

### Versioning
- `versionName` in `android/app/build.gradle`; `versionCode` comes from `NAZLAWI_VERSION_CODE` (default 1). **Every Play upload needs a higher versionCode.**

## التوقيع / Release signing
لا يوجد keystore في المستودع، ولازم ما يتحطش فيه أبداً. / No keystore is committed — never commit one.

1. أنشئ مفتاح الرفع مرة واحدة واحفظه في مكان آمن (مع كلمة السر) — لو ضاع مش هتقدر تحدّث التطبيق إلا عن طريق دعم جوجل.
   Create the upload key once and back it up safely (with its passwords):
   ```bash
   keytool -genkeypair -v -keystore ~/keys/nazlawi-upload.jks -alias nazlawi-upload \
     -keyalg RSA -keysize 4096 -validity 10000 \
     -dname "CN=Nazlawi, O=Nazlawi, C=EG"
   ```
2. اكتب `mobile/android/keystore.properties` (متجاهَل في git) / create the git-ignored file:
   ```properties
   storeFile=/home/you/keys/nazlawi-upload.jks
   storePassword=********
   keyAlias=nazlawi-upload
   keyPassword=********
   ```
   (CI alternative: env vars `NAZLAWI_KEYSTORE`, `NAZLAWI_KEYSTORE_PASSWORD`, `NAZLAWI_KEY_ALIAS`, `NAZLAWI_KEY_PASSWORD`.)
3. Build the bundle for Play:
   ```bash
   CAP_SERVER_URL=https://your-domain NAZLAWI_VERSION_CODE=1 npm run bundle:release
   # → mobile/android/app/build/outputs/bundle/release/app-release.aab
   ```
4. Use **Play App Signing** (default): Google keeps the app signing key; your keystore is only the *upload* key.

## النشر على Google Play / Play Store upload
1. Create a Google Play Console developer account (one-time US$25 fee, identity verification). New personal accounts must run a **closed test with at least 12 testers for 14 days** before production access.
2. Play Console → **Create app**: name «نزلاوي», default language Arabic, App, Free.
3. **App content**: privacy policy URL (`https://your-domain/privacy`), app access (provide a demo login for review), ads (no), content rating questionnaire, target audience, data safety form (account email/name/phone, photos/videos uploaded by providers, approximate location: none), government apps: no.
4. **Store listing**: short + full description (ar/en), icon 512×512 (`mobile/assets/icon-only.png` resized), feature graphic 1024×500, at least 2 phone screenshots (`screenshots/` has web captures; take real ones from a phone).
5. **Testing → Internal testing** → Create release → upload `app-release.aab` → add testers (emails) → roll out. Then closed testing → production.
6. Before each release: bump `NAZLAWI_VERSION_CODE` and `versionName`.

## إشعارات Firebase / Firebase push (later)
Config points (nothing is active yet):
1. Firebase console → new project → **Add Android app** with package `com.nazlawi.app` → download `google-services.json` → put it at `mobile/android/app/google-services.json` (git-ignored). The Gradle build applies the Google Services plugin automatically when that file exists.
2. Web app env: `NEXT_PUBLIC_PUSH_ENABLED=1` (Vercel). `src/components/NativeBridge.tsx` then asks for notification permission (Android 13+), registers with FCM and receives the token in `onToken` — **TODO:** send it to a new endpoint (e.g. `POST /api/me/push-tokens`, table `PushToken(userId, token, platform)`), and send messages from the server with the Firebase Admin SDK (service-account JSON as a Vercel env var).
3. Notification taps: `onOpen` navigates to `data.url` (relative paths only).
4. Optional: notification icon `ic_stat_notify` (white silhouette) in `res/drawable`, and a default channel.
> Don't enable `NEXT_PUBLIC_PUSH_ENABLED` without `google-services.json` in the shipped APK: FCM registration would crash the app.

## غير مختبر / Not yet tested
- The APK has not been run on a device or emulator (the build box's emulator wouldn't boot). Please test: launch/splash, login, back button, pull-to-refresh, offline page (airplane mode), tel/WhatsApp/maps links, gallery + camera uploads (image and video), RTL/LTR switch, Android 15 edge-to-edge status bar.
- Session cookies: the app uses the same cookie login as the website (WebView cookie store, persists between launches).
