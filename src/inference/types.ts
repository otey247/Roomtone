import type { Meeting, ModelState, RuntimeKind, TranscriptSegment } from '../domain/types.ts';
import type { PcmAudioStream } from './expo-audio-stream-adapter.ts';

export type RuntimeStatus = 'idle' | 'preparing' | 'recording' | 'processing' | 'stopped' | 'error';

export interface RuntimeSpeaker {
  id: string;
  displayName?: string;
  isNamed?: boolean;
}

export interface RuntimeCallbacks {
  onStatus(status: RuntimeStatus, detail?: string): void;
  onSpeaker(speaker: RuntimeSpeaker): void;
  onPartial(segment: TranscriptSegment): void;
  onFinal(segment: TranscriptSegment): void;
  onAudioLevel(level: number): void;
  onError(error: Error): void;
}

export interface RuntimeStartOptions {
  meeting: Meeting;
  speechModel?: ModelState;
  vadModel?: ModelState;
  callbacks: RuntimeCallbacks;
  audioStream?: PcmAudioStream;
}

export interface RuntimeStopResult { audioUri?: string }

export interface MeetingRuntime {
  readonly kind: RuntimeKind;
  isAvailable(): Promise<boolean>;
  start(options: RuntimeStartOptions): Promise<void>;
  stop(): Promise<RuntimeStopResult>;
  release(): Promise<void>;
}
