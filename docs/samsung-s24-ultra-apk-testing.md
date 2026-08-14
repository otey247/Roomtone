# Samsung Galaxy S24 Ultra APK Build and Test Guide

This guide builds a standalone Roomtone preview APK, installs it on a Samsung Galaxy S24 Ultra, verifies the native speech runtime, and executes a repeatable physical-device test pass.

The preview package is `com.otey247.roomtone.preview`, so it can coexist with a future production installation. The APK is compiled in release mode with the JavaScript bundle and application assets embedded. It does not require Metro after installation. GitHub and local preview builds use the generated Android debug signing key for trusted internal testing only. Do not distribute this APK as a production release or submit it to Google Play.

## Included build and test assets

- GitHub Actions workflow for a standalone `arm64-v8a` APK
- SHA-256, package badging, signature output, and build metadata
- Windows PowerShell build, install, launch, and diagnostic commands
- EAS internal-distribution APK profile
- In-app application, device, permission, native-module, storage, and model diagnostics
- Deterministic Samsung S24 Ultra readiness tests
- Maestro guided-demo smoke flow
- Physical-device acceptance and endurance matrix

## Recommended build path: GitHub Actions

1. Open the Roomtone repository in GitHub.
2. Select **Actions**.
3. Select **Build Samsung S24 Ultra APK**.
4. Select **Run workflow** and choose the required branch.
5. Download the `roomtone-s24-ultra-apk-*` artifact after the workflow succeeds.
6. Extract the artifact ZIP.

The artifact contains:

```text
roomtone-s24-ultra-preview-<run>.apk
roomtone-s24-ultra-preview-<run>.apk.sha256
roomtone-s24-ultra-preview-<run>.apk.signature.txt
roomtone-s24-ultra-preview-<run>.apk.badging.txt
build-metadata.json
```

The workflow performs all source checks, a clean Expo Android prebuild, release compilation for `arm64-v8a`, APK signature verification, package-name verification, archive-integrity validation, and artifact upload with 14-day retention.

## Local Windows build

### Prerequisites

Install:

- Node.js 22.18.0 or newer
- JDK 17
- Android Studio
- Android SDK Platform Tools
- Android SDK Build Tools
- The Android platform and NDK requested by Expo SDK 57

Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` to the Android SDK directory and place `adb` on `PATH`.

From the repository root:

```powershell
npm run apk:build:s24
```

The script installs dependencies, runs all Roomtone checks, performs a clean prebuild, runs `:app:assembleRelease` for `arm64-v8a`, and writes the verified APK and metadata to `dist/`.

Optional arguments:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\android\build-s24-apk.ps1 `
  -VersionCode 26081401 `
  -OutputDirectory .\dist
```

Use `-SkipDependencyInstall` or `-SkipChecks` only after the same source revision has already passed those steps.

## EAS internal build

The `s24-apk` profile produces an installable APK. The `production` profile remains an Android App Bundle profile.

```bash
npx eas-cli login
npx eas-cli build --platform android --profile s24-apk
```

The first EAS build may prompt for Expo project association and Android credentials.

## Prepare the Samsung Galaxy S24 Ultra

### Enable USB debugging

1. Open **Settings > About phone > Software information**.
2. Tap **Build number** seven times.
3. Authenticate when prompted.
4. Return to **Settings > Developer options**.
5. Enable **USB debugging**.

Connect the phone with a USB-C cable that supports data. In the USB notification choose **Transferring files / Android Auto**. Accept the RSA debugging prompt only on a trusted computer.

Verify the connection:

```powershell
adb devices -l
```

The phone must appear with state `device`, not `unauthorized` or `offline`.

### Samsung Auto Blocker

Auto Blocker can prevent APK installation and USB commands. Keep it enabled during normal use. If it blocks this trusted internal installation:

1. Open **Settings > Security and privacy > Auto Blocker**.
2. Temporarily disable Auto Blocker.
3. Install the checksum-verified Roomtone APK.
4. Re-enable Auto Blocker.

Opening the APK from My Files or a browser may also require permission for that specific source under **Install unknown apps**. ADB installation generally avoids the browser or file-manager source permission.

## Install with ADB

```powershell
npm run apk:install:s24 -- -ApkPath "C:\path\to\roomtone-s24-ultra-preview-123.apk"
```

The installer:

- Requires exactly one authorized device unless `-Serial` is supplied
- Reads manufacturer, model, Android version, API level, and ABI
- Recognizes SM-S928-series S24 Ultra models
- Rejects a target without `arm64-v8a`
- Replaces an earlier preview build
- Launches Roomtone after installation
- Prints the installed version and version code

Examples:

```powershell
npm run apk:install:s24 -- `
  -ApkPath ".\dist\roomtone-s24-ultra-preview-123.apk" `
  -Serial "R5CX123456A"

npm run apk:install:s24 -- `
  -ApkPath ".\dist\roomtone-s24-ultra-preview-122.apk" `
  -AllowDowngrade

npm run apk:install:s24 -- `
  -ApkPath ".\dist\roomtone-s24-ultra-preview-123.apk" `
  -ClearData
```

Do not use `-GrantRuntimePermissions` during the first acceptance pass. The normal microphone and notification permission behavior must be tested.

## Verify the installed APK

Open **Roomtone Preview > Settings > APK and device diagnostics** and confirm:

- Package is `com.otey247.roomtone.preview`
- Build variant is `preview`
- Build architecture is `arm64-v8a`
- Commit SHA and version code match the workflow metadata
- Device is recognized as a Samsung Galaxy S24 Ultra
- Native Whisper module is Ready
- Local document storage is Ready

Copy the diagnostic report and retain it with the test record.

Before local models and microphone permission are configured, those checks may show **Needs setup**. If **Native Whisper module** is Blocked, the wrong binary was installed. Expo Go cannot exercise the native speech runtime.

## Install the first local models

Start with:

- **English · Fast**, approximately 32 MB
- **Voice activity detection**, approximately 865 KB

Avoid the approximately 488 MB experimental speaker-turn model until baseline recording, transcription, background behavior, and export are stable.

After installation:

1. Select **English · Fast** as active.
2. Allow microphone access when Roomtone requests it.
3. Refresh diagnostics.
4. Confirm **Native meeting runtime: Ready to test**.

Models, meetings, audio, and exports are stored in the Roomtone application sandbox. Clearing application data or uninstalling the preview package removes them.

## Acceptance sequence

### Gate 1: installation and identity

- SHA-256 matches the included checksum file
- Android accepts the APK signature
- App launches without Metro
- App name is **Roomtone Preview**
- Package, version, version code, commit SHA, variant, and architecture are correct
- Installing a newer preview preserves data unless `-ClearData` is used

### Gate 2: guided-demo smoke

1. Start a meeting with **Guided demo** selected.
2. Confirm participant notification.
3. Verify partial and final transcript updates.
4. Verify keywords, decisions, actions, and questions.
5. Add a bookmark.
6. End the meeting.
7. Copy the meeting brief.
8. Export and open a PDF.

Optional automation:

```bash
maestro test tests/mobile/s24-guided-demo.yaml
```

### Gate 3: five-minute native meeting

Use two speakers in a quiet room. Select **On-device audio**, confirm visible recording consent, and speak naturally for five minutes. Include `security`, `decision`, and `action item`, alternating speakers every 20 to 40 seconds.

Verify:

- Transcript segments appear while recording
- Final segments persist after completion
- No audio or transcript from before consent is captured
- Keywords and grounded outcomes link to transcript evidence
- Meeting remains available after force-closing and reopening the app

Record first-text latency, obvious omissions, repeated or hallucinated text, speaker-turn behavior, device temperature, and battery change.

### Gate 4: background and lock screen

Run a 15-minute native meeting:

1. Record in the foreground.
2. Lock the phone for five minutes.
3. Unlock and confirm the meeting remains active.
4. Use another app for five minutes.
5. Return to Roomtone.
6. Confirm the foreground recording notification and transcript continuity.
7. End the meeting and inspect timestamps for gaps.

For diagnosis only, Samsung battery mode can be set under **Settings > Apps > Roomtone Preview > Battery > Unrestricted**. Record that change because unrestricted mode must not be assumed for normal users.

### Gate 5: interruptions and routes

Test individually:

- USB-C or wired microphone connection
- Bluetooth headset connection and disconnection
- Notification sounds
- Incoming-call interruption
- Microphone permission revocation followed by a new meeting
- Audio-route change while Roomtone is backgrounded

A visible error or controlled recovery is acceptable. Silent data loss, hidden recording, or process termination is a failure.

### Gate 6: multilingual operation

Install **Multilingual · Fast** and test English, Spanish, mixed English and Spanish, original-only mode, and Add-English mode. Verify original text remains separate from translated text.

### Gate 7: export and retention

- Copy a transcript segment and meeting brief
- Export all four PDF templates
- Open and share each PDF through Android
- Exercise meeting and audio retention settings
- Remove a speech model and verify native capture becomes unavailable without damaging completed meetings

### Gate 8: endurance

Run separate 30, 60, and 120-minute meetings. For each pass record:

- Starting and ending battery
- Maximum observed temperature or thermal warning
- Transcript continuity
- App or model crashes
- Android low-memory or foreground-service warnings
- Final meeting persistence after restart
- PDF export success

A pass requires no forced termination, no unrecoverable meeting loss, and a final meeting record that opens after application restart.

## Collect diagnostics

Keep Roomtone running and execute:

```powershell
npm run apk:diagnostics:s24
```

With multiple devices:

```powershell
npm run apk:diagnostics:s24 -- -Serial "R5CX123456A"
```

The command creates a ZIP under `dist/` containing device properties, package and app-operation state, process memory, battery, device-idle state, foreground recording service state, Roomtone process logcat, and a machine-readable summary.

Review the ZIP before sharing it. Meeting titles or transcribed content may appear in logs.

## Useful commands

```powershell
adb shell dumpsys package com.otey247.roomtone.preview
$pid = adb shell pidof com.otey247.roomtone.preview
adb logcat --pid=$pid -v threadtime
adb shell appops get com.otey247.roomtone.preview RECORD_AUDIO
adb shell dumpsys meminfo com.otey247.roomtone.preview
adb shell pm clear com.otey247.roomtone.preview
adb uninstall com.otey247.roomtone.preview
```

## Troubleshooting

### Device is unauthorized

Unlock the phone, accept the RSA prompt, then run:

```powershell
adb kill-server
adb start-server
adb devices -l
```

If the prompt does not appear, revoke USB debugging authorizations in Developer options and reconnect.

### Phone only charges

Choose **Transferring files / Android Auto** from the USB notification. Use a known data cable and a direct USB port.

### `INSTALL_FAILED_VERSION_DOWNGRADE`

Build with a higher version code or install with `-AllowDowngrade`.

### `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

The existing preview package was signed with a different key. Uninstall `com.otey247.roomtone.preview`, then reinstall. Uninstalling removes preview data and downloaded models.

### APK installation is blocked

Temporarily disable Samsung Auto Blocker for the verified internal build, install, then re-enable it.

### Native Whisper is missing

Install the APK produced by the Samsung S24 workflow, local `assembleRelease` script, or EAS `s24-apk` profile. Expo Go does not include `whisper.rn`.

### Recording stops after lock screen

Confirm notification permission and the foreground recording notification. For diagnosis, temporarily set Roomtone Preview battery use to **Unrestricted**, then collect `recording-service.txt`, `device-idle.txt`, and logcat.

## Official references

- Expo local app development: https://docs.expo.dev/guides/local-app-development/
- Expo EAS build profiles: https://docs.expo.dev/build/eas-json/
- Expo Android APK builds: https://docs.expo.dev/deploy/build-project/
- Android command-line APK builds: https://developer.android.com/build/building-cmdline
- Samsung developer options: https://developer.samsung.com/health/data/guide/phone-developer-options.html
- Samsung USB connection modes: https://www.samsung.com/us/support/answer/ANS10013049/
- Samsung Auto Blocker: https://www.samsung.com/ca/support/mobile-devices/protect-your-samsung-galaxy-with-auto-blocker/
