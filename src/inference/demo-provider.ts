import { demoScript, demoSegment } from '../data/demo.ts';
import type { TranscriptSegment } from '../domain/types.ts';
import type { MeetingRuntime, RuntimeCallbacks, RuntimeStartOptions, RuntimeStopResult } from './types.ts';

const speakerLabels = { jo: 'Jo', sarah: 'Sarah', mike: 'Mike' } as const;

export class DemoMeetingRuntime implements MeetingRuntime {
  readonly kind = 'demo' as const;
  private callbacks?: RuntimeCallbacks;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private meetingId = '';
  private stopped = true;

  async isAvailable(): Promise<boolean> { return true; }

  async start(options: RuntimeStartOptions): Promise<void> {
    this.callbacks = options.callbacks;
    this.meetingId = options.meeting.id;
    this.stopped = false;
    options.callbacks.onStatus('preparing', 'Preparing local demo stream');
    for (const [key, label] of Object.entries(speakerLabels)) {
      options.callbacks.onSpeaker({ id: `${options.meeting.id}_${key}`, displayName: label, isNamed: true });
    }
    const startTimer = setTimeout(() => options.callbacks.onStatus('recording', 'Local simulation'), 250);
    this.timers.push(startTimer);
    demoScript.forEach((entry, index) => {
      const delay = 850 + index * 1_650;
      const final = demoSegment(options.meeting.id, `${options.meeting.id}_${entry.speakerKey}`, index, entry);
      const partial: TranscriptSegment = {
        ...final,
        originalText: final.originalText.slice(0, Math.max(16, Math.round(final.originalText.length * 0.58))),
        translatedText: undefined,
        confidence: 0.62,
        isFinal: false
      };
      this.timers.push(setTimeout(() => {
        if (!this.stopped) {
          options.callbacks.onAudioLevel(0.28 + (index % 4) * 0.15);
          options.callbacks.onPartial(partial);
        }
      }, delay));
      this.timers.push(setTimeout(() => {
        if (!this.stopped) {
          options.callbacks.onFinal(final);
          options.callbacks.onAudioLevel(0.05);
        }
      }, delay + 620));
    });
  }

  async stop(): Promise<RuntimeStopResult> {
    this.stopped = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.callbacks?.onAudioLevel(0);
    this.callbacks?.onStatus('stopped');
    return {};
  }

  async release(): Promise<void> { await this.stop(); this.callbacks = undefined; this.meetingId = ''; }
}
