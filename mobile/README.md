# CharpsDev — Android app shell

A thin [Capacitor](https://capacitorjs.com/) native wrapper around the live
CharpsDev web app. **This directory contains no application logic of its
own.** Its WebView loads `https://charpsdev.vercel.app` directly (see
`capacitor.config.ts`'s `server.url`), so:

- Next.js Middleware (`frontend/proxy.ts` route protection), Server
  Components, and the existing cookie/bearer-token auth all keep working
  exactly as they do on the web — nothing in `frontend/` had to change.
- Every `vercel deploy --prod` you run updates the app too, instantly, with
  no separate mobile release needed for content or logic changes.
- The only things that live in this directory are: native app identity
  (package name, icon, splash screen, status bar color) and the Gradle/Java
  scaffolding Capacitor needs to produce an `.apk`/`.aab`.

## Directory layout

```
mobile/
├── capacitor.config.ts   # appId, appName, and the server.url that points at the live site
├── android/              # Generated native Android Studio project (Gradle)
├── assets/               # Source icon/splash images used by `npx capacitor-assets generate`
├── www/                  # Placeholder only — never actually served, see index.html's comment
└── package.json
```

## Local development

You need Node.js, and — only if you want to build the APK locally instead of
via CI — a JDK (17 or newer) and the Android SDK (or Android Studio, which
bundles both).

```bash
cd mobile
npm install

# Re-copy native config after editing capacitor.config.ts, or after
# `npm install`-ing a new Capacitor plugin:
npm run sync

# Open the native project in Android Studio (requires Android Studio installed
# locally; not available in this sandbox):
npm run open:android

# Or build a release APK straight from the CLI (requires JDK + Android SDK on
# your PATH, i.e. ANDROID_HOME set and `sdk.dir` resolvable):
npm run build:android
# → mobile/android/app/build/outputs/apk/release/app-release.apk
```

Without any release-signing secrets configured (see below), the release
build falls back to Android's default **debug** signing key. That APK
installs fine on a device/emulator for testing, but Google Play will reject
it — you need a real upload keystore for that (also below).

## Building via GitHub Actions (recommended — no local Android Studio needed)

`.github/workflows/android-build.yml` builds this project in CI and uploads
the resulting APK as a downloadable workflow artifact. It runs automatically
whenever `mobile/**` changes on `main`, or you can trigger it manually:

**GitHub UI:** Actions tab → "Build Android APK (CharpsDev)" → **Run workflow**.
Optionally check "Also build a Play Store .aab bundle" if you need an `.aab`
for a Play Store upload (Play Store requires `.aab`, not `.apk`).

**GitHub CLI:**
```bash
gh workflow run android-build.yml
# then, once it finishes:
gh run download --name charpsdev-release-apk
```

Once the run finishes, download the APK from the run's **Artifacts** section
(or via `gh run download` above). Artifacts are retained for 30 days.

## Signing a real release (required before any Play Store upload)

By default, CI (and a local build with no `keystore.properties`) signs with
Android's debug key — fine for sideloading onto a test device, **not**
acceptable for the Play Store, and the debug key is not something you should
ship long-term anyway since anyone can resign an APK with the well-known
public debug key.

To get a real, private upload keystore and wire it into CI:

```bash
# 1. Generate a keystore (do this ONCE — back this file up somewhere safe;
#    losing it means you can NEVER update the app again on the same Play
#    Store listing under the same signing identity):
keytool -genkeypair -v \
  -keystore charpsdev-release.keystore \
  -alias charpsdev \
  -keyalg RSA -keysize 2048 -validity 10000

# 2. Base64-encode it for storage as a GitHub Secret:
base64 -w0 charpsdev-release.keystore > charpsdev-release.keystore.b64
# (macOS: use `base64 -i charpsdev-release.keystore -o charpsdev-release.keystore.b64` instead)
```

Then in the GitHub repo → **Settings → Secrets and variables → Actions**,
add these four repository secrets:

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `charpsdev-release.keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password you set in step 1 |
| `ANDROID_KEY_ALIAS` | `charpsdev` (or whatever `-alias` you used) |
| `ANDROID_KEY_PASSWORD` | the key password you set in step 1 |

Once all four are set, every future CI build automatically signs with this
real keystore instead of the debug fallback — no workflow file changes
needed. Delete the local `.keystore` / `.b64` files after uploading (keep a
secure offline backup of the original `.keystore` — GitHub Secrets are
write-only and can't be retrieved back out).

## Updating app identity, icon, or splash screen

- **App name / package ID**: edit `capacitor.config.ts` (`appName`,
  `appId`), then re-run `npx cap sync android`. Changing `appId` after a
  Play Store listing exists effectively creates a *new* app listing — avoid
  changing it post-launch.
- **Icon / splash screen**: replace the images in `assets/` (see the
  `@capacitor/assets` config implicit in file naming —
  `icon-foreground.png` + `icon-background.png` for the adaptive icon,
  `splash.png` / `splash-dark.png` for the splash screen), then regenerate:
  ```bash
  npx capacitor-assets generate --android
  ```
- **Status bar / splash background color**: edit the `StatusBar` /
  `SplashScreen` plugin config blocks in `capacitor.config.ts`.

## Native plugins already wired in

- `@capacitor/status-bar` — controls the native status bar color/style
- `@capacitor/splash-screen` — native splash screen shown on cold start
- `@capacitor/app` — app-lifecycle events (e.g. Android back-button handling)

None of these are called from custom native code yet — they're available
for a future enhancement (e.g. having the loaded web page call
`StatusBar.setBackgroundColor()` via `window.Capacitor` when it detects it's
running inside the native shell, to keep the OS status bar in sync with the
in-app light/dark toggle at the native chrome level, not just the CSS
`theme-color` meta tag).

## Known limitation of "remote URL" mode

This app shows the live website inside a native WebView — it is not an
offline-capable app, and won't launch without a working internet connection
(same as visiting the site in a mobile browser). If offline support is ever
needed, that requires switching to a static Next.js export bundled into the
app instead, which is a larger change — see the discussion in the main repo
about why that path was not chosen (breaks Next.js Middleware, requires
converting Server Components to Client Components).
