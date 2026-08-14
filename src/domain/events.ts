// Local-only event contracts for a visibly consented recording session. They do not enable hidden or remote capture.
import type { Bookmark, Insight, KeywordOccurrence, Meeting, Speaker, TranscriptSegment } from './types.ts';

export type MeetingEvent =
  | { type: 'meeting.started'; occurredAt: string }
  | { type: 'meeting.stopped'; occurredAt: string; audioUri?: string }
  | { type: 'transcript.segmentFinalized'; occurredAt: string; segment: TranscriptSegment }
  | { type: 'transcript.segmentCorrected'; occurredAt: string; segment: TranscriptSegment }
  | { type: 'speaker.created'; occurredAt: string; speaker: Speaker }
  | { type: 'speaker.renamed'; occurredAt: string; speakerId: string; displayName: string }
  | { type: 'keyword.detected'; occurredAt: string; occurrence: KeywordOccurrence }
  | { type: 'insight.detected'; occurredAt: string; insight: Insight }
  | { type: 'bookmark.created'; occurredAt: string; bookmark: Bookmark }
  | { type: 'meeting.summaryUpdated'; occurredAt: string; summary: string };

export interface StoredMeetingEvent { id?: number; meetingId: string; event: MeetingEvent }

export function meetingSearchText(meeting: Meeting): string {
  return [
    meeting.title,
    ...meeting.speakers.map((speaker) => speaker.displayName),
    ...meeting.segments.flatMap((segment) => [segment.originalText, segment.translatedText ?? '']),
    ...meeting.insights.map((insight) => insight.text),
    meeting.summary ?? ''
  ].join('\n').toLocaleLowerCase();
}
