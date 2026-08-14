import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Roomtone',
  slug: 'roomtone',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'roomtone',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.otey247.roomtone',
    infoPlist: {
      NSMicrophoneUsageDescription: 'Roomtone uses the microphone only while you record a meeting.',
      UIBackgroundModes: ['audio']
    }
  },
  android: {
    package: 'com.otey247.roomtone',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F4F1EA'
    },
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.POST_NOTIFICATIONS'
    ]
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    ['expo-audio', {
      microphonePermission: 'Roomtone uses the microphone only while you record a meeting.',
      enableBackgroundRecording: true
    }],
    ['expo-splash-screen', {
      image: './assets/splash.png',
      imageWidth: 240,
      resizeMode: 'contain',
      backgroundColor: '#F4F1EA'
    }]
  ]
});
