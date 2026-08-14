import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { getRecordingPermissionsAsync } from 'expo-audio';
import { NativeModules, Platform } from 'react-native';
import type { AppSettings, ModelState } from '../domain/types.ts';
import {
  evaluateDeviceReadiness,
  type DeviceReadinessResult,
  type MicrophonePermissionState
} from '../domain/device-readiness.ts';

export interface DeviceDiagnosticSnapshot {
  collectedAt: string;
  application: {
    name: string;
    applicationId: string;
    version: string;
    buildVersion: string;
    buildVariant: string;
    buildSha: string;
    buildChannel: string;
    buildTime: string;
    architecture: string;
  };
  device: {
    manufacturer: string;
    modelName: string;
    designName: string;
    productName: string;
    osVersion: string;
    osBuildId: string;
    apiLevel: string;
    cpuArchitectures: string;
    totalMemory: string;
    physicalDevice: boolean;
  };
  runtime: {
    microphonePermission: MicrophonePermissionState;
    nativeWhisperAvailable: boolean;
    documentStorageAvailable: boolean;
    activeSpeechModel: string;
    activeSpeechModelInstalled: boolean;
    vadModelInstalled: boolean;
  };
  readiness: DeviceReadinessResult;
}

interface EmbeddedBuildMetadata {
  variant?: unknown;
  sha?: unknown;
  channel?: unknown;
  builtAt?: unknown;
  architecture?: unknown;
}

function asDisplayString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getEmbeddedBuildMetadata(): EmbeddedBuildMetadata {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') return {};
  const build = (extra as Record<string, unknown>).build;
  return build && typeof build === 'object' ? build as EmbeddedBuildMetadata : {};
}

function formatMemory(bytes: number | null): string {
  if (!bytes || bytes <= 0) return 'Unavailable';
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

export async function collectDeviceDiagnostics(
  settings: AppSettings,
  models: ModelState[]
): Promise<DeviceDiagnosticSnapshot> {
  const embeddedBuild = getEmbeddedBuildMetadata();
  const microphone = await getRecordingPermissionsAsync();
  const microphonePermission: MicrophonePermissionState = microphone.granted
    ? 'granted'
    : microphone.status === 'undetermined'
      ? 'undetermined'
      : 'denied';
  const activeSpeechModel = models.find((model) => model.id === settings.activeSpeechModelId);
  const vadModel = models.find((model) => model.role === 'vad');
  const nativeWhisperAvailable = Boolean(NativeModules.RNWhisper || NativeModules.Whisper);
  const documentStorageAvailable = Boolean(FileSystem.documentDirectory);

  const readiness = evaluateDeviceReadiness({
    platform: Platform.OS,
    physicalDevice: Device.isDevice,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    designName: Device.designName,
    productName: Device.productName,
    nativeWhisperAvailable,
    microphonePermission,
    documentStorageAvailable,
    activeSpeechModelInstalled: Boolean(activeSpeechModel?.installed),
    vadModelInstalled: Boolean(vadModel?.installed)
  });

  return {
    collectedAt: new Date().toISOString(),
    application: {
      name: Application.applicationName ?? 'Roomtone',
      applicationId: Application.applicationId ?? 'Unavailable',
      version: Application.nativeApplicationVersion ?? 'Unavailable',
      buildVersion: Application.nativeBuildVersion ?? 'Unavailable',
      buildVariant: asDisplayString(embeddedBuild.variant, 'local'),
      buildSha: asDisplayString(embeddedBuild.sha, 'local'),
      buildChannel: asDisplayString(embeddedBuild.channel, 'local'),
      buildTime: asDisplayString(embeddedBuild.builtAt, 'local'),
      architecture: asDisplayString(embeddedBuild.architecture, 'universal')
    },
    device: {
      manufacturer: Device.manufacturer ?? 'Unavailable',
      modelName: Device.modelName ?? 'Unavailable',
      designName: Device.designName ?? 'Unavailable',
      productName: Device.productName ?? 'Unavailable',
      osVersion: Device.osVersion ?? String(Platform.Version),
      osBuildId: Device.osBuildId ?? 'Unavailable',
      apiLevel: Device.platformApiLevel ? String(Device.platformApiLevel) : String(Platform.Version),
      cpuArchitectures: Device.supportedCpuArchitectures?.join(', ') ?? 'Unavailable',
      totalMemory: formatMemory(Device.totalMemory),
      physicalDevice: Device.isDevice
    },
    runtime: {
      microphonePermission,
      nativeWhisperAvailable,
      documentStorageAvailable,
      activeSpeechModel: activeSpeechModel?.title ?? 'No active speech model',
      activeSpeechModelInstalled: Boolean(activeSpeechModel?.installed),
      vadModelInstalled: Boolean(vadModel?.installed)
    },
    readiness
  };
}

export function formatDeviceDiagnosticReport(snapshot: DeviceDiagnosticSnapshot): string {
  const lines = [
    'ROOMTONE DEVICE DIAGNOSTICS',
    `Collected: ${snapshot.collectedAt}`,
    '',
    'APPLICATION',
    `Name: ${snapshot.application.name}`,
    `Package: ${snapshot.application.applicationId}`,
    `Version: ${snapshot.application.version} (${snapshot.application.buildVersion})`,
    `Variant: ${snapshot.application.buildVariant}`,
    `Build SHA: ${snapshot.application.buildSha}`,
    `Build channel: ${snapshot.application.buildChannel}`,
    `Build time: ${snapshot.application.buildTime}`,
    `Build architecture: ${snapshot.application.architecture}`,
    '',
    'DEVICE',
    `Manufacturer: ${snapshot.device.manufacturer}`,
    `Model: ${snapshot.device.modelName}`,
    `Design: ${snapshot.device.designName}`,
    `Product: ${snapshot.device.productName}`,
    `Android: ${snapshot.device.osVersion} (API ${snapshot.device.apiLevel})`,
    `OS build: ${snapshot.device.osBuildId}`,
    `CPU: ${snapshot.device.cpuArchitectures}`,
    `Memory: ${snapshot.device.totalMemory}`,
    `Physical device: ${snapshot.device.physicalDevice ? 'yes' : 'no'}`,
    '',
    'RUNTIME',
    `Native meeting ready: ${snapshot.readiness.nativeMeetingReady ? 'yes' : 'no'}`,
    `S24 Ultra recognized: ${snapshot.readiness.targetDeviceDetected ? 'yes' : 'no'}`,
    `Microphone permission: ${snapshot.runtime.microphonePermission}`,
    `Native Whisper: ${snapshot.runtime.nativeWhisperAvailable ? 'available' : 'missing'}`,
    `Document storage: ${snapshot.runtime.documentStorageAvailable ? 'available' : 'missing'}`,
    `Speech model: ${snapshot.runtime.activeSpeechModel} (${snapshot.runtime.activeSpeechModelInstalled ? 'installed' : 'not installed'})`,
    `VAD model: ${snapshot.runtime.vadModelInstalled ? 'installed' : 'not installed'}`,
    '',
    'READINESS CHECKS',
    ...snapshot.readiness.checks.map((check) => `${check.status.toUpperCase()} | ${check.label} | ${check.detail}`)
  ];
  return lines.join('\n');
}
