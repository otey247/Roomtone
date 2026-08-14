# Samsung Galaxy S24 Ultra APK Build and Test Guide

This guide creates a standalone Roomtone preview APK, installs it on a Samsung Galaxy S24 Ultra, verifies that the native speech runtime is present, and runs a repeatable physical-device test pass.

The test APK uses the package name `com.otey247.roomtone.preview`, so it can coexist with a future production installation. It is compiled in release mode so the JavaScript bundle and assets are embedded and Metro is not required. The GitHub and local preview paths use a debug signing key for internal testing only. Do not distribute this APK as a production release or submit it to Google Play.

## What this repository provides

- A manually runnable and pull-request-triggered GitHub Actions APK build
- An `arm64-v8a` standalone APK optimized for the S24 Ultra
- SHA-256, package metadata, and signature verification files beside the APK
- A Windows PowerShell local build command
- A device-aware ADB installation command
- An ADB diagnostics bundle command
- In-app APK, device, permission, native-module, model, and storage diagnostics
- A Maestro guided-demo smoke flow
- An EAS internal-distribution APK profile

## Recommended path: build in GitHub Actions

1. Open the Roomtone repository in GitHub.
2. Select **Actions**.
3. Select **Build Samsung S24 Ultra APK**.
4. Select **Run workflow** and choose the desired branch.
5. After the workflow succeeds, download the `roomtone-s24-ultra-apk-*` artifact.
6. Extract the ZIP. It contains:
   - `roomtone-s24-ultra-preview-<run>.apk`
   - the APK SHA-256 file
   - signing-certificate output
   - Android package badging
   - `build-metadata.json`

The workflow also runs the complete Roomtone source checks before compilation. It then performs a clean Expo prebuild, compiles a standalone release-mode APK for `arm64-v8a`, verifies the APK signature, checks the embedded package name, checks ZIP integrity, and uploads the result for 14 days.

## Local Windows build

### Prerequisites

Install:

- Node.js 22.18.0 or newer
- JDK 17
- Android Studio
- Android SDK Platform Tools
- Android SDK Build Tools
- The Android platform and NDK requested by Expo SDK 56

Set either `ANDROID_HOME` or `ANDROID_SDK_ROOT` to the Android SDK directory and ensure `adb` is on `PATH`.

From the repository root:

```powershell
npm run apk:build:s24
```

The script:

1. Installs dependencies.
2. Runs all Roomtone source checks.
3. Performs a clean Android prebuild.
4. Builds `:app:assembleRelease` for `arm64-v8a`.
5. Copies the standalone APK into `dist/`.
6. Creates SHA-256 and build-metadata files.
7. Verifies the APK signature when `apksigner.bat` is available.

Useful options:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\android\build-s24-apk.ps1 `
  -VersionCode 26081401 `
  -OutputDirectory .\dist

powershell -ExecutionPolicy Bypass -File .\scripts\android\build-s24-apk.ps1 `
  -SkipDependencyInstall `
  -SkipChecks
```

Only use the skip flags after the same source revision has already passed those steps.

## EAS internal-distribution build

The `s24-apk` profile in `eas.json` produces an installable APK rather than a Play Store app bundle.

```bash
npx eas-cli login
npx eas-cli build --platform android --profile s24-apk
```

The first EAS build may ask you to associate the repository with an Expo project and create Android credentials. The EAS artifact is appropriate for internal device testing. The `production` profile remains configured to produce an Android App Bundle.

## Prepare the Samsung Galaxy S24 Ultra

### Enable developer options

1. Open **Settings**.
2. Open **About phone**.
3. Open **Software information**.
4. Tap **Build number** seven times.
5. Authenticate when prompted.
6. Return to **Settings** and open **Developer options**.
7. Enable **USB debugging**.

Samsung documents this sequence in its developer and support guidance.

### Connect the phone

Use a USB-C cable that supports data, not a charge-only cable.

On newer One UI versions, USB may default to charging only:

1. Connect the phone to the PC.
2. Pull down the notification shade.
3. Select the USB connection notification.
4. Choose **Transferring files / Android Auto**.
5. Accept the RSA debugging prompt and select **Always allow from this computer** only on a trusted computer.

Verify the connection:

```powershell
adb devices -l
```

The device must appear with state `device`, not `unauthorized` or `offline`.

### Samsung Auto Blocker

Samsung Auto Blocker can block APK installation and USB commands. Keep it enabled during normal use. If it prevents this trusted test installation:

1. Open **Settings > Security and privacy > Auto Blocker**.
2. Temporarily disable Auto Blocker.
3. Install the verified Roomtone APK.
4. Re-enable Auto Blocker after installation.

If installing by opening the APK from My Files or a browser, Android may also require permission for that specific source under **Security and privacy > More security settings > Install unknown apps**. ADB installation normally avoids the browser or file-manager source permission, but Auto Blocker can still block USB commands.

## Install the APK with ADB

From the repository root:

```powershell
npm run apk:install:s24 -- -ApkPath "C:\path\to\roomtone-s24-ultra-preview-123.apk"
```

The installer:

- Requires exactly one authorized device unless `-Serial` is supplied
- Reads manufacturer, model, Android version, API level, and ABI
- Warns when the device is not recognized as an SM-S928-series S24 Ultra
- Rejects non-`arm64-v8a` targets
- Replaces an earlier preview installation
- Launches Roomtone after installation
- Prints the installed version and version code

Additional options:

```powershell
# Select a device when more than one is attached
npm run apk:install:s24 -- `
  -ApkPath ".\dist\roomtone-s24-ultra-preview-123.apk" `
  -Serial "R5CX123456A"

# Permit installing an older version code
npm run apk:install:s24 -- `
  -ApkPath ".\dist\roomtone-s24-ultra-preview-122.apk" `
  -AllowDowngrade

# Clear prior Roomtone Preview data after installation
npm run apk:install:s24 -- `
  -ApkPath ".\dist\roomtone-s24-ultra-preview-123.apk" `
  -ClearData
```

Do not use `-GrantRuntimePermissions` for the first acceptance pass. The normal microphone and notification prompts must be tested.

## First-run readiness check

1. Open Roomtone Preview.
2. Open **Settings**.
3. Find **APK and device diagnostics**.
4. Confirm:
   - Package is `com.otey247.roomtone.preview`.
   - Build variant is `preview`.
   - Architecture is `arm64-v8a`.
   - Manufacturer and model identify the Samsung S24 Ultra.
   - **Native Whisper module** is Ready.
   - **Local document storage** is Ready.
5. Copy the diagnostic report and retain it with the test record.

Before model installation, the microphone may show **Needs setup**, and the speech and VAD models will show **Needs setup**. That is expected.

If **Native Whisper module** is Blocked, the wrong binary was installed. Expo Go cannot exercise the native speech path.

## Install the initial local models

For the first native test, install:

- **English · Fast**, approximately 32 MB
- **Voice activity detection**, approximately 865 KB

Avoid starting with the approximately 488 MB experimental speaker-turn model. Establish baseline recording, transcription, background behavior, and export first.

After installation:

1. Select **English · Fast** as active.
2. Allow microphone access when prompted.
3. Refresh **APK and device diagnostics**.
4. Confirm **Native meeting runtime: Ready to test**.

Model files are stored in Roomtone's application sandbox. Removing the app or clearing app data removes downloaded models and local meetings.

## Test sequence

### Gate 1: installation and identity

- APK SHA-256 matches the included checksum.
- Android accepts the signature.
- The app launches without Metro.
- The app is named **Roomtone Preview**.
- Package, version, version code, commit SHA, and architecture appear in diagnostics.
- Reinstalling a newer version preserves local data unless `-ClearData` is used.

### Gate 2: guided-demo smoke test

Run the guided demo before native audio:

1. Start a meeting.
2. Keep **Guided demo** selected.
3. Confirm participant notification.
4. Start the meeting.
5. Verify partial and final transcript updates.
6. Verify keywords, decisions, actions, and questions.
7. Add a bookmark.
8. End the meeting.
9. Copy the meeting brief.
10. Export and open a PDF.

Optional Maestro run:

```bash
maestro test tests/mobile/s24-guided-demo.yaml
```

The flow uses the preview package ID and clears app state.

### Gate 3: five-minute native meeting

Use two speakers in a quiet room.

- Select **On-device audio**.
- Confirm visible recording consent.
- Speak naturally for five minutes.
- Include the configured terms `security`, `decision`, and `action item`.
- Alternate speakers every 20 to 40 seconds.
- Verify transcript segments appear and remain after completion.
- Verify no audio or transcript from before consent is captured.
- Verify the meeting is available after force-closing and reopening Roomtone.

Record:

- time from speech to first usable text
- obvious missed phrases
- repeated or hallucinated text
- speaker-turn behavior
- device temperature
- battery percentage before and after

### Gate 4: background and lock-screen behavior

Run a 15-minute native meeting:

1. Start recording in the foreground.
2. Lock the phone for five minutes.
3. Unlock and verify the meeting is still active.
4. Switch to another app for five minutes.
5. Return to Roomtone.
6. Verify the persistent recording indication and transcript continuity.
7. End the meeting and inspect timestamps for gaps.

If Samsung places Roomtone into deep sleep during longer testing, open **Settings > Apps > Roomtone Preview > Battery** and select **Unrestricted** for the duration of the test. Record this change because unrestricted battery use should not be assumed for normal users.

### Gate 5: interruptions and audio routes

Test separately:

- Wired or USB-C microphone connection
- Bluetooth headset connection and disconnection
- Notification sounds
- Screen rotation attempts
- Incoming call interruption
- Microphone permission revoked while idle, followed by a new meeting
- Audio route change while Roomtone is in the background

Expected behavior is a visible error or controlled recovery. Silent data loss, hidden recording, and app termination are failures.

### Gate 6: multilingual behavior

Install **Multilingual · Fast** and test:

- English-only meeting
- Spanish-only meeting
- English and Spanish in one meeting
- Original-only mode
- Add-English translation mode

Verify original text is preserved separately from translated text.

### Gate 7: export and retention

- Copy one transcript segment.
- Copy the meeting brief.
- Export all four PDF templates.
- Open and share each PDF using Android's share sheet.
- Set short retention options, restart the app, and verify only expired content is removed.
- Remove a local model and verify native capture becomes unavailable without affecting completed meetings.

### Gate 8: endurance

Run 30, 60, and 120-minute meetings on separate passes.

For every pass record:

- starting and ending battery
- maximum observed device temperature or thermal warning
- transcript continuity
- model and app crashes
- Android low-memory or foreground-service warnings
- final meeting persistence
- PDF export success

A pass requires no forced termination, no unrecoverable meeting loss, and a final meeting record that opens after the app is restarted.

## Capture a diagnostic bundle

Keep Roomtone running, then execute:

```powershell
npm run apk:diagnostics:s24
```

With multiple devices:

```powershell
npm run apk:diagnostics:s24 -- -Serial "R5CX123456A"
```

The command creates a ZIP under `dist/` containing:

- device properties
- package and permission state
- memory state
- battery state
- device-idle state
- background recording service state
- Roomtone process logcat
- a machine-readable summary

Review the ZIP before sharing it. Logs may include meeting titles or transcribed text.

## Useful ADB commands

```powershell
# Confirm the installed package
adb shell dumpsys package com.otey247.roomtone.preview

# Follow only the Roomtone process
$pid = adb shell pidof com.otey247.roomtone.preview
adb logcat --pid=$pid -v threadtime

# Inspect microphone app operations
adb shell appops get com.otey247.roomtone.preview RECORD_AUDIO

# Inspect process memory
adb shell dumpsys meminfo com.otey247.roomtone.preview

# Clear Roomtone Preview data
adb shell pm clear com.otey247.roomtone.preview

# Uninstall the preview app
adb uninstall com.otey247.roomtone.preview
```

## Troubleshooting

### `adb` shows `unauthorized`

Unlock the phone, accept the RSA prompt, then run:

```powershell
adb kill-server
adb start-server
adb devices -l
```

If no prompt appears, revoke USB debugging authorizations in Developer options, reconnect, and authorize again.

### The phone only charges

Use the USB notification to select **Transferring files / Android Auto**. Try a known data cable and a direct USB port rather than a hub.

### `INSTALL_FAILED_VERSION_DOWNGRADE`

Build with a higher version code or install with `-AllowDowngrade`. Clearing app data does not change Android's version-code check.

### `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

The existing package was signed with a different key. Uninstall `com.otey247.roomtone.preview`, then install the new APK. Uninstalling removes preview data and downloaded models.

### APK installation is blocked

Temporarily disable Samsung Auto Blocker for this verified internal build, install the APK, then re-enable Auto Blocker.

### Native Whisper is missing

Confirm the package is `com.otey247.roomtone.preview` and the APK came from the Samsung S24 workflow, local `assembleRelease` script, or EAS `s24-apk` profile. Expo Go does not include `whisper.rn`.

### Model download fails

Confirm network access and free storage, then retry the smaller English and VAD models. Capture the in-app diagnostic report and ADB bundle if the failure repeats.

### Recording stops after the screen locks

Confirm notification permission, verify Roomtone's foreground recording notification, and temporarily set the app battery mode to **Unrestricted** for diagnosis. Capture `recording-service.txt`, `device-idle.txt`, and logcat.

## Official references

- Expo local app development: https://docs.expo.dev/guides/local-app-development/
- Expo EAS build profiles: https://docs.expo.dev/build/eas-json/
- Expo Android APK builds: https://docs.expo.dev/deploy/build-project/
- Android command-line APK builds: https://developer.android.com/build/building-cmdline
- Samsung developer options: https://developer.samsung.com/health/data/guide/phone-developer-options.html
- Samsung USB connection modes: https://www.samsung.com/us/support/answer/ANS10013049/
- Samsung Auto Blocker: https://www.samsung.com/ca/support/mobile-devices/protect-your-samsung-galaxy-with-auto-blocker/
