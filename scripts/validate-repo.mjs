import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import process from 'node:process';

const requiredFiles = [
  'README.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'App.tsx',
  'index.ts',
  'app.config.ts',
  'eas.json',
  'package.json',
  'src/app/RoomtoneApp.tsx',
  'src/app/RoomtoneContext.tsx',
  'src/domain/types.ts',
  'src/domain/device-readiness.ts',
  'src/inference/whisper-provider.ts',
  'src/infrastructure/meeting-repository.ts',
  'src/infrastructure/device-diagnostics.ts',
  'docs/architecture.md',
  'docs/privacy-and-security.md',
  'docs/model-runtime.md',
  'docs/evaluation.md',
  'docs/samsung-s24-ultra-apk-testing.md',
  '.github/workflows/ci.yml',
  '.github/workflows/android-apk.yml',
  'scripts/android/build-s24-apk.ps1',
  'scripts/android/install-s24-apk.ps1',
  'scripts/android/collect-s24-diagnostics.ps1',
  'tests/domain/device-readiness.test.ts',
  'tests/mobile/s24-guided-demo.yaml',
  'assets/icon.png',
  'assets/adaptive-icon.png',
  'assets/splash.png',
  'assets/favicon.png'
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required file: ${file}`);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.private !== true) failures.push('package.json must remain private until release automation is defined.');
if (packageJson.main !== 'index.ts') failures.push('package.json main must point to index.ts.');
if (!packageJson.scripts?.check) failures.push('package.json must expose the full check script.');
if (!packageJson.scripts?.['apk:build:s24']) failures.push('package.json must expose the Samsung S24 APK build script.');
if (!packageJson.scripts?.['apk:install:s24']) failures.push('package.json must expose the Samsung S24 APK install script.');
if (!packageJson.scripts?.['apk:diagnostics:s24']) failures.push('package.json must expose the Samsung S24 diagnostics script.');
if (!packageJson.dependencies?.['expo-audio']) failures.push('expo-audio is required for the native PCM stream.');
if (!packageJson.dependencies?.['whisper.rn']) failures.push('whisper.rn is required for the native speech provider.');
if (!packageJson.dependencies?.['expo-application']) failures.push('expo-application is required for installed APK identity.');
if (!packageJson.dependencies?.['expo-device']) failures.push('expo-device is required for physical-device diagnostics.');
if (!packageJson.dependencies?.['expo-constants']) failures.push('expo-constants is required for embedded build metadata.');

const easJson = JSON.parse(readFileSync('eas.json', 'utf8'));
if (easJson.build?.['s24-apk']?.android?.buildType !== 'apk') {
  failures.push('eas.json must expose an s24-apk profile with android.buildType set to apk.');
}
if (easJson.build?.production?.android?.buildType !== 'app-bundle') {
  failures.push('eas.json production must remain an Android App Bundle profile.');
}

const appConfig = readFileSync('app.config.ts', 'utf8');
if (!appConfig.includes('com.otey247.roomtone.preview')) {
  failures.push('app.config.ts must define the preview APK package.');
}
if (!appConfig.includes('ROOMTONE_ANDROID_VERSION_CODE')) {
  failures.push('app.config.ts must embed a configurable Android version code.');
}
if (!appConfig.includes('EXPO_PUBLIC_BUILD_SHA')) {
  failures.push('app.config.ts must embed build provenance.');
}

const apkWorkflow = readFileSync('.github/workflows/android-apk.yml', 'utf8');
if (!apkWorkflow.includes(':app:assembleRelease')) {
  failures.push('The APK workflow must build a standalone release-mode artifact.');
}
if (!apkWorkflow.includes('arm64-v8a')) {
  failures.push('The APK workflow must build the Samsung S24 arm64 architecture.');
}
if (!apkWorkflow.includes('actions/upload-artifact@v4')) {
  failures.push('The APK workflow must upload the installable artifact.');
}
if (!apkWorkflow.includes('apksigner')) {
  failures.push('The APK workflow must verify the generated APK signature.');
}

for (const asset of ['assets/icon.png', 'assets/adaptive-icon.png', 'assets/splash.png', 'assets/favicon.png']) {
  if (!existsSync(asset)) continue;
  if (extname(asset) !== '.png') failures.push(`${asset} must be PNG.`);
  if (statSync(asset).size < 200) failures.push(`${asset} appears to be empty or invalid.`);
}

const sourceFiles = [
  'src/app/RoomtoneApp.tsx',
  'src/app/RoomtoneContext.tsx',
  'src/hooks/useMeetingSession.ts',
  'src/inference/whisper-provider.ts',
  'src/infrastructure/device-diagnostics.ts',
  'src/screens/SettingsScreen.tsx'
];
for (const file of sourceFiles) {
  const content = readFileSync(join(process.cwd(), file), 'utf8');
  if (/\b(?:TODO|FIXME)\b/.test(content)) failures.push(`${file} contains unresolved TODO or FIXME markers.`);
  if (/console\.log\(/.test(content)) failures.push(`${file} contains console.log.`);
}

if (failures.length) {
  console.error(`Repository validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Repository validation passed: ${requiredFiles.length} required files and APK contracts verified.`);
