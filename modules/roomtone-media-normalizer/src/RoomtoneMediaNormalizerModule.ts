import { requireOptionalNativeModule } from 'expo';

export interface MediaNormalizationResult {
  outputUri: string;
  durationMs: number;
  sourceSampleRate: number;
  sourceChannels: number;
  outputSampleRate: number;
  outputChannels: number;
  pcmBytes: number;
}

interface RoomtoneMediaNormalizerNativeModule {
  normalizeToWav(sourceUri: string, outputUri: string): Promise<MediaNormalizationResult>;
}

const nativeModule = requireOptionalNativeModule<RoomtoneMediaNormalizerNativeModule>('RoomtoneMediaNormalizer');

export default {
  isAvailable: Boolean(nativeModule),
  async normalizeToWav(sourceUri: string, outputUri: string): Promise<MediaNormalizationResult> {
    if (!nativeModule) throw new Error('The Roomtone media normalizer is not included in this application build.');
    return nativeModule.normalizeToWav(sourceUri, outputUri);
  }
};
