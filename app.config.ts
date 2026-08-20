import type { ConfigContext, ExpoConfig } from 'expo/config';

const variant = process.env.ROOMTONE_APP_VARIANT === 'preview' ? 'preview' : 'production';
const isPreview = variant === 'preview';
const requestedVersionCode = Number.parseInt(process.env.ROOMTONE_ANDROID_VERSION_CODE ?? '1', 10);
const versionCode = Number.isFinite(requestedVersionCode) && requestedVersionCode > 0
  ? Math.min(requestedVersionCode, 2_100_000_000)
  : 1;
const buildSha = process.env.EXPO_PUBLIC_BUILD_SHA
  ?? process.env.EAS_BUILD_GIT_COMMIT_HASH
  ?? 'local';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isPreview ? 'Roomtone Preview' : 'Roomtone',
  slug: 'roomtone',
  version: '0.2.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: isPreview ? 'roomtone-preview' : 'roomtone',
  extra: {
    ...(config.extra ?? {}),
    build: {
      variant,
      sha: buildSha,
      channel: process.env.EXPO_PUBLIC_BUILD_CHANNEL ?? 'local',
      builtAt: process.env.EXPO_PUBLIC_BUILD_TIME ?? 'local',
      architecture: process.env.EXPO_PUBLIC_BUILD_ARCHITECTURE ?? 'universal'
    }
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: isPreview ? 'com.otey247.roomtone.preview' : 'com.otey247.roomtone',
    infoPlist: {
      NSMicrophoneUsageDescription: 'Roomtone uses the microphone only while you record a visibly acknowledged session.',
      NSCalendarsUsageDescription: 'Roomtone reads selected calendar events so recordings can use the correct title and participant context.',
      NSCalendarsFullAccessUsageDescription: 'Roomtone reads selected calendar events so recordings can use the correct title and participant context.',
      UIBackgroundModes: ['audio']
    }
  },
  android: {
    package: isPreview ? 'com.otey247.roomtone.preview' : 'com.otey247.roomtone',
    versionCode,
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F4F1EA'
    },
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR'
    ]
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    ['expo-audio', {
      microphonePermission: 'Roomtone uses the microphone only while you record a visibly acknowledged session.',
      enableBackgroundRecording: true,
      enableBackgroundPlayback: true
    }],
    ['expo-calendar', {
      calendarPermission: 'Roomtone reads selected calendar events so recordings can use the correct title and participant context.'
    }],
    'expo-document-picker',
    ['expo-splash-screen', {
      image: './assets/splash.png',
      imageWidth: 240,
      resizeMode: 'contain',
      backgroundColor: '#F4F1EA'
    }]
  ]
});
