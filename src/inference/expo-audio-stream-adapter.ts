export interface PcmAudioStreamConfig {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  bufferSize?: number;
  audioSource?: number;
}

export interface PcmAudioStreamData {
  data: Uint8Array;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

export interface PcmAudioStream {
  initialize(config: PcmAudioStreamConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRecording(): boolean;
  onData(callback: (data: PcmAudioStreamData) => void): void;
  onError(callback: (error: string) => void): void;
  onStatusChange(callback: (isRecording: boolean) => void): void;
  release(): Promise<void>;
}

interface ExpoAudioStreamLike {
  start(): Promise<void>;
  stop(): void;
  isStreaming?: boolean;
}

export interface ExpoAudioStreamBuffer {
  data: ArrayBuffer;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

function normalizePcm16(buffer: ExpoAudioStreamBuffer, targetRate: number): Uint8Array {
  const source = new Int16Array(buffer.data);
  const channels = Math.max(1, buffer.channels);
  const frames = Math.floor(source.length / channels);
  const mono = new Int16Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) sum += source[frame * channels + channel] ?? 0;
    mono[frame] = Math.max(-32_768, Math.min(32_767, Math.round(sum / channels)));
  }
  if (buffer.sampleRate === targetRate) return new Uint8Array(mono.buffer);
  const ratio = buffer.sampleRate / targetRate;
  const outputLength = Math.max(1, Math.floor(mono.length / ratio));
  const output = new Int16Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const leftIndex = Math.floor(sourcePosition);
    const rightIndex = Math.min(mono.length - 1, leftIndex + 1);
    const fraction = sourcePosition - leftIndex;
    const left = mono[leftIndex] ?? 0;
    const right = mono[rightIndex] ?? left;
    output[index] = Math.round(left + (right - left) * fraction);
  }
  return new Uint8Array(output.buffer);
}

export class ExpoAudioStreamAdapter implements PcmAudioStream {
  private stream?: ExpoAudioStreamLike;
  private recording = false;
  private targetRate = 16_000;
  private dataCallback?: (data: PcmAudioStreamData) => void;
  private errorCallback?: (error: string) => void;
  private statusCallback?: (isRecording: boolean) => void;

  attach(stream: ExpoAudioStreamLike): void { this.stream = stream; }

  push(buffer: ExpoAudioStreamBuffer): void {
    if (!this.recording || !this.dataCallback) return;
    try {
      this.dataCallback({
        data: normalizePcm16(buffer, this.targetRate),
        sampleRate: this.targetRate,
        channels: 1,
        timestamp: Math.round(buffer.timestamp * 1000)
      });
    } catch (error) {
      this.errorCallback?.(error instanceof Error ? error.message : 'Unable to normalize microphone audio.');
    }
  }

  async initialize(config: PcmAudioStreamConfig): Promise<void> {
    this.targetRate = config.sampleRate ?? 16_000;
    if (!this.stream) throw new Error('Expo AudioStream is not attached.');
  }

  async start(): Promise<void> {
    if (!this.stream) throw new Error('Expo AudioStream is unavailable.');
    this.recording = true;
    try {
      await this.stream.start();
      this.statusCallback?.(true);
    } catch (error) {
      this.recording = false;
      this.statusCallback?.(false);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.stream?.stop();
    this.recording = false;
    this.statusCallback?.(false);
  }

  isRecording(): boolean { return this.recording || Boolean(this.stream?.isStreaming); }
  onData(callback: (data: PcmAudioStreamData) => void): void { this.dataCallback = callback; }
  onError(callback: (error: string) => void): void { this.errorCallback = callback; }
  onStatusChange(callback: (isRecording: boolean) => void): void { this.statusCallback = callback; }

  async release(): Promise<void> {
    if (this.recording) await this.stop();
    this.dataCallback = undefined;
    this.errorCallback = undefined;
    this.statusCallback = undefined;
  }
}
