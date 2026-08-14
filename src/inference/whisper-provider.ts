import type { ModelState, TranscriptSegment } from '../domain/types.ts';
import { createId } from '../utils/id.ts';
import type { MeetingRuntime, RuntimeCallbacks, RuntimeStartOptions, RuntimeStopResult } from './types.ts';

interface WhisperSegment { text?: string; t0?: number; t1?: number }
interface WhisperResult { result?: string; segments?: WhisperSegment[]; language?: string }
interface RealtimeEvent {
  type?: string;
  sliceIndex?: number;
  data?: WhisperResult;
  recordingTime?: number;
  vadEvent?: { timestamp?: number; duration?: number; type?: string };
}

export class WhisperMeetingRuntime implements MeetingRuntime {
  readonly kind = 'native' as const;
  private callbacks?: RuntimeCallbacks;
  private transcriber?: { start(): Promise<void>; stop(): Promise<void>; release?: () => Promise<void> };
  private whisperContext?: {
    transcribeData(data: ArrayBuffer, options: Record<string, unknown>): { promise: Promise<WhisperResult> };
    release?: () => Promise<void>;
  };
  private vadContext?: { release?: () => Promise<void> };
  private audioUri?: string;
  private meetingId = '';
  private sourceLanguage = 'auto';
  private translateToEnglish = false;
  private meetingStartedAtMs = 0;
  private lastFinalEndMs = 0;
  private sliceBounds = new Map<number, { startMs: number; endMs: number }>();
  private supportsSpeakerTurns = false;
  private speakerTurn = 1;
  private lastPartialBySlice = new Map<number, TranscriptSegment>();
  private audioBySlice = new Map<number, Uint8Array>();

  async isAvailable(): Promise<boolean> {
    try {
      const { NativeModules } = await import('react-native');
      return Boolean(NativeModules.RNWhisper || NativeModules.Whisper);
    } catch {
      return false;
    }
  }

  async start(options: RuntimeStartOptions): Promise<void> {
    const speechModel = options.speechModel;
    const vadModel = options.vadModel;
    if (!speechModel?.installed || !speechModel.localUri) {
      throw new Error('Install and select a local speech model before recording.');
    }
    if (!vadModel?.installed || !vadModel.localUri) {
      throw new Error('Install the voice activity model before recording.');
    }
    this.callbacks = options.callbacks;
    this.meetingId = options.meeting.id;
    this.meetingStartedAtMs = new Date(options.meeting.startedAt).getTime();
    this.lastFinalEndMs = 0;
    this.sliceBounds.clear();
    this.lastPartialBySlice.clear();
    this.audioBySlice.clear();
    this.speakerTurn = 1;
    this.sourceLanguage = options.meeting.sourceLanguage;
    this.translateToEnglish = options.meeting.translationMode === 'english';
    this.supportsSpeakerTurns = speechModel.supportsSpeakerTurns;
    this.callbacks.onStatus('preparing', 'Loading local speech models');

    const audio = await import('expo-audio');
    const permission = await audio.requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error('Microphone permission is required to record a meeting.');
    await audio.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      allowsBackgroundRecording: true
    });

    const whisperModuleId: string = 'whisper.rn';
    const realtimeModuleId: string = 'whisper.rn/realtime-transcription';
    const [{ initWhisper, initWhisperVad }, realtimeModule, fsModule] = await Promise.all([
      import(whisperModuleId),
      import(realtimeModuleId),
      import('react-native-fs')
    ]);
    const RNFS = (fsModule.default ?? fsModule) as typeof import('react-native-fs');
    const meetingDirectory = `${RNFS.DocumentDirectoryPath}/roomtone`;
    if (!(await RNFS.exists(meetingDirectory))) await RNFS.mkdir(meetingDirectory);
    this.audioUri = `file://${meetingDirectory}/${this.meetingId}.wav`;

    this.whisperContext = await initWhisper({
      filePath: speechModel.localUri,
      useGpu: true
    }) as unknown as typeof this.whisperContext;
    this.vadContext = await initWhisperVad({
      filePath: vadModel.localUri,
      useGpu: true,
      nThreads: 4
    }) as unknown as typeof this.vadContext;

    const audioStream = options.audioStream;
    if (!audioStream) throw new Error('The native PCM audio stream is unavailable.');
    const RealtimeTranscriber = realtimeModule.RealtimeTranscriber as unknown as new (
      dependencies: Record<string, unknown>,
      configuration: Record<string, unknown>,
      callbacks: Record<string, unknown>
    ) => { start(): Promise<void>; stop(): Promise<void>; release?: () => Promise<void> };

    this.transcriber = new RealtimeTranscriber(
      {
        whisperContext: this.whisperContext,
        vadContext: this.vadContext,
        audioStream,
        fs: RNFS
      },
      {
        audioSliceSec: 22,
        audioMinSec: 1.2,
        maxSlicesInMemory: 3,
        audioOutputPath: this.audioUri.replace('file://', ''),
        audioStreamConfig: {
          sampleRate: 16_000,
          channels: 1,
          bitsPerSample: 16,
          bufferSize: 16 * 1024
        },
        transcribeOptions: {
          language: this.sourceLanguage || 'auto',
          translate: false,
          tokenTimestamps: true,
          tdrzEnable: this.supportsSpeakerTurns,
          maxThreads: 4
        }
      },
      {
        onBeginTranscribe: async ({ audioData, sliceIndex }: { audioData: Uint8Array; sliceIndex: number }) => {
          this.audioBySlice.set(sliceIndex, audioData);
          return true;
        },
        onTranscribe: (event: RealtimeEvent) => this.handleRealtimeEvent(event, speechModel),
        onSliceTranscriptionStabilized: (text: string) => this.handleStableText(text, speechModel),
        onVad: (event: { confidence?: number; type?: string }) => {
          const level = event.type === 'silence' ? 0.04 : Math.max(0.12, Math.min(1, event.confidence ?? 0.45));
          this.callbacks?.onAudioLevel(level);
        },
        onStatusChange: (active: boolean) => this.callbacks?.onStatus(active ? 'recording' : 'processing'),
        onError: (message: string) => this.callbacks?.onError(new Error(message))
      }
    );
    await this.transcriber.start();
    this.callbacks.onStatus('recording', 'On-device Whisper');
  }

  private handleRealtimeEvent(event: RealtimeEvent, model: ModelState): void {
    const sliceIndex = event.sliceIndex ?? 0;
    const text = event.data?.result?.trim();
    if (!text) return;

    const durationMs = Math.max(250, Math.round(event.recordingTime ?? 0));
    const vadEndMs = event.vadEvent?.timestamp
      ? Math.max(0, Math.round(event.vadEvent.timestamp - this.meetingStartedAtMs))
      : undefined;
    const existing = this.sliceBounds.get(sliceIndex);
    const startMs = existing?.startMs ?? Math.max(
      this.lastFinalEndMs,
      vadEndMs === undefined ? this.lastFinalEndMs : Math.max(0, vadEndMs - durationMs)
    );
    const endMs = Math.max(existing?.endMs ?? 0, vadEndMs ?? (startMs + durationMs), startMs + durationMs);
    this.sliceBounds.set(sliceIndex, { startMs, endMs });

    const language = event.data?.language?.trim() || this.sourceLanguage;
    const parsed = this.makeSegment(text, String(sliceIndex), startMs, endMs, false, model, language);
    this.lastPartialBySlice.set(sliceIndex, parsed);
    this.callbacks?.onPartial(parsed);
  }

  private handleStableText(text: string, model: ModelState): void {
    const candidates = [...this.lastPartialBySlice.entries()];
    const [sliceIndex, partial] = candidates[candidates.length - 1] ?? [0, undefined];
    if (!partial) return;
    const bounds = this.sliceBounds.get(sliceIndex) ?? { startMs: partial.startMs, endMs: partial.endMs };
    const segments = this.splitSpeakerTurns(text, sliceIndex, bounds.startMs, bounds.endMs, model, partial.originalLanguage);
    segments.forEach((segment) => this.callbacks?.onFinal(segment));
    this.lastFinalEndMs = Math.max(this.lastFinalEndMs, ...segments.map((segment) => segment.endMs));
    this.lastPartialBySlice.delete(sliceIndex);
    this.sliceBounds.delete(sliceIndex);
    if (this.translateToEnglish && partial.originalLanguage.toLocaleLowerCase() !== 'en') {
      void this.translateSlice(sliceIndex, segments, partial.originalLanguage);
    } else {
      this.audioBySlice.delete(sliceIndex);
    }
  }

  private splitSpeakerTurns(
    text: string,
    sliceIndex: number,
    startMs: number,
    endMs: number,
    model: ModelState,
    language: string
  ): TranscriptSegment[] {
    const chunks = text.split(/\[SPEAKER_TURN\]/i).map((part) => part.trim()).filter(Boolean);
    const safeChunks = chunks.length ? chunks : [text.trim()];
    const duration = Math.max(1, endMs - startMs);
    return safeChunks.map((chunk, index) => {
      if (index > 0) this.speakerTurn += 1;
      const chunkStart = startMs + Math.round(duration * index / safeChunks.length);
      const chunkEnd = startMs + Math.round(duration * (index + 1) / safeChunks.length);
      const segmentKey = index === 0 ? String(sliceIndex) : `${sliceIndex}_turn_${index}`;
      return this.makeSegment(chunk, segmentKey, chunkStart, chunkEnd, true, model, language);
    });
  }

  private makeSegment(
    text: string,
    index: string,
    startMs: number,
    endMs: number,
    isFinal: boolean,
    model: ModelState,
    language: string
  ): TranscriptSegment {
    const now = new Date().toISOString();
    const speakerId = `${this.meetingId}_native_speaker_${model.supportsSpeakerTurns ? this.speakerTurn : 1}`;
    this.callbacks?.onSpeaker({ id: speakerId });
    return {
      id: `${this.meetingId}_native_segment_${index}`,
      meetingId: this.meetingId,
      speakerId,
      startMs,
      endMs,
      originalText: text.replace(/\[SPEAKER_TURN\]/gi, '').trim(),
      originalLanguage: language,
      confidence: isFinal ? 0.82 : 0.55,
      isFinal,
      words: [],
      transcriptionVersion: 1,
      diarizationVersion: model.supportsSpeakerTurns ? 1 : 0,
      createdAt: now,
      updatedAt: now
    };
  }

  private async translateSlice(sliceIndex: number, originals: TranscriptSegment[], language: string): Promise<void> {
    const audio = this.audioBySlice.get(sliceIndex);
    if (!audio || !this.whisperContext || !originals.length) return;
    try {
      const copy = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
      const result = await this.whisperContext.transcribeData(copy, {
        language: language || 'auto',
        translate: true,
        maxThreads: 4,
        tdrzEnable: false
      }).promise;
      const translated = result.result?.trim();
      const first = originals[0];
      if (!translated || !first) return;
      const corrected: TranscriptSegment = {
        ...first,
        translatedText: translated,
        transcriptionVersion: first.transcriptionVersion + 1,
        updatedAt: new Date().toISOString()
      };
      this.callbacks?.onFinal(corrected);
    } catch (error) {
      this.callbacks?.onStatus(
        'recording',
        `Translation delayed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    } finally {
      this.audioBySlice.delete(sliceIndex);
    }
  }

  async stop(): Promise<RuntimeStopResult> {
    this.callbacks?.onStatus('processing', 'Finalizing local transcript');
    await this.transcriber?.stop();
    this.callbacks?.onAudioLevel(0);
    this.callbacks?.onStatus('stopped');
    return { audioUri: this.audioUri };
  }

  async release(): Promise<void> {
    try { await this.transcriber?.release?.(); } catch { /* best-effort native release */ }
    try { await this.whisperContext?.release?.(); } catch { /* best-effort native release */ }
    try { await this.vadContext?.release?.(); } catch { /* best-effort native release */ }
    this.transcriber = undefined;
    this.whisperContext = undefined;
    this.vadContext = undefined;
    this.callbacks = undefined;
    this.audioBySlice.clear();
    this.lastPartialBySlice.clear();
    this.sliceBounds.clear();
    this.lastFinalEndMs = 0;
    this.meetingStartedAtMs = 0;
    this.audioUri = undefined;
    this.meetingId = createId('released');
  }
}
