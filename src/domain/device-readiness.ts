export type ReadinessStatus = 'ready' | 'warning' | 'blocked';
export type MicrophonePermissionState = 'granted' | 'denied' | 'undetermined';

export interface DeviceReadinessInput {
  platform: string;
  physicalDevice: boolean;
  manufacturer?: string | null;
  modelName?: string | null;
  designName?: string | null;
  productName?: string | null;
  nativeWhisperAvailable: boolean;
  microphonePermission: MicrophonePermissionState;
  documentStorageAvailable: boolean;
  activeSpeechModelInstalled: boolean;
  vadModelInstalled: boolean;
}

export interface DeviceReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

export interface DeviceReadinessResult {
  targetDeviceDetected: boolean;
  nativeMeetingReady: boolean;
  checks: DeviceReadinessCheck[];
}

export function isSamsungS24Ultra(input: Pick<
  DeviceReadinessInput,
  'manufacturer' | 'modelName' | 'designName' | 'productName'
>): boolean {
  const manufacturer = input.manufacturer?.toLocaleLowerCase() ?? '';
  const identity = [
    input.modelName,
    input.designName,
    input.productName
  ].filter(Boolean).join(' ').toLocaleLowerCase();

  return manufacturer.includes('samsung')
    && (identity.includes('sm-s928') || identity.includes('galaxy s24 ultra'));
}

export function evaluateDeviceReadiness(input: DeviceReadinessInput): DeviceReadinessResult {
  const targetDeviceDetected = isSamsungS24Ultra(input);
  const checks: DeviceReadinessCheck[] = [
    {
      id: 'platform',
      label: 'Android APK runtime',
      status: input.platform === 'android' ? 'ready' : 'blocked',
      detail: input.platform === 'android'
        ? 'The installed binary is running on Android.'
        : `This test package is intended for Android, not ${input.platform}.`
    },
    {
      id: 'physical-device',
      label: 'Physical device',
      status: input.physicalDevice ? 'ready' : 'warning',
      detail: input.physicalDevice
        ? 'Roomtone is running on physical hardware.'
        : 'An emulator cannot validate microphone, thermal, or background behavior.'
    },
    {
      id: 'target-device',
      label: 'Samsung S24 Ultra target',
      status: targetDeviceDetected ? 'ready' : 'warning',
      detail: targetDeviceDetected
        ? 'Samsung Galaxy S24 Ultra hardware was recognized.'
        : 'The app can still run, but this is not recognized as an SM-S928-series device.'
    },
    {
      id: 'native-whisper',
      label: 'Native Whisper module',
      status: input.nativeWhisperAvailable ? 'ready' : 'blocked',
      detail: input.nativeWhisperAvailable
        ? 'The APK contains the native speech runtime.'
        : 'The native speech module is missing. Install the standalone APK rather than Expo Go.'
    },
    {
      id: 'microphone',
      label: 'Microphone permission',
      status: input.microphonePermission === 'granted'
        ? 'ready'
        : input.microphonePermission === 'undetermined'
          ? 'warning'
          : 'blocked',
      detail: input.microphonePermission === 'granted'
        ? 'Microphone access is granted.'
        : input.microphonePermission === 'undetermined'
          ? 'Roomtone will request microphone access when native capture starts.'
          : 'Microphone access is denied in Android settings.'
    },
    {
      id: 'storage',
      label: 'Local document storage',
      status: input.documentStorageAvailable ? 'ready' : 'blocked',
      detail: input.documentStorageAvailable
        ? 'The app sandbox is available for models, meetings, audio, and exports.'
        : 'The app sandbox is unavailable.'
    },
    {
      id: 'speech-model',
      label: 'Active speech model',
      status: input.activeSpeechModelInstalled ? 'ready' : 'warning',
      detail: input.activeSpeechModelInstalled
        ? 'The selected speech model is installed locally.'
        : 'Install and select a speech model from Settings before native capture.'
    },
    {
      id: 'vad-model',
      label: 'Voice activity model',
      status: input.vadModelInstalled ? 'ready' : 'warning',
      detail: input.vadModelInstalled
        ? 'The local VAD model is installed.'
        : 'Install the VAD model from Settings before native capture.'
    }
  ];

  const nativeMeetingReady = input.platform === 'android'
    && input.physicalDevice
    && input.nativeWhisperAvailable
    && input.microphonePermission === 'granted'
    && input.documentStorageAvailable
    && input.activeSpeechModelInstalled
    && input.vadModelInstalled;

  return { targetDeviceDetected, nativeMeetingReady, checks };
}
