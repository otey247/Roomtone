import type { Insight, Speaker, TranscriptSegment } from '../../src/domain/types.ts';

const now = '2026-08-14T12:00:00.000Z';

export function speaker(overrides: Partial<Speaker> = {}): Speaker {
  return {
    id: 'spk_jo',
    meetingId: 'mtg_test',
    displayName: 'Jo',
    isNamed: true,
    isEnrolled: false,
    createdAt: now,
    ...overrides
  };
}

export function segment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: 'seg_1',
    meetingId: 'mtg_test',
    speakerId: 'spk_jo',
    startMs: 1_000,
    endMs: 6_000,
    originalText: 'I will send the architecture review by Friday.',
    originalLanguage: 'en',
    confidence: 0.92,
    isFinal: true,
    words: [],
    transcriptionVersion: 1,
    diarizationVersion: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function insight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'ins_1',
    meetingId: 'mtg_test',
    segmentId: 'seg_1',
    kind: 'action',
    text: 'Jo will send the architecture review by Friday.',
    owner: 'Jo',
    dueText: 'Friday',
    evidenceStartMs: 1_000,
    confidence: 0.84,
    resolved: false,
    createdAt: now,
    ...overrides
  };
}
