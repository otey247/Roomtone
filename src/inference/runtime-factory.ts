import type { RuntimeKind } from '../domain/types.ts';
import { DemoMeetingRuntime } from './demo-provider.ts';
import type { MeetingRuntime } from './types.ts';
import { WhisperMeetingRuntime } from './whisper-provider.ts';

export function createMeetingRuntime(kind: RuntimeKind): MeetingRuntime {
  return kind === 'native' ? new WhisperMeetingRuntime() : new DemoMeetingRuntime();
}
