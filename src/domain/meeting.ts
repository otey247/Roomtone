import { calculateMeetingMetrics, emptyMeetingMetrics } from './analytics.ts';
import { deduplicateInsights, extractInsights, generateSummary } from './insights.ts';
import { definitionsFromTerms, occurrencesForSegment } from './keywords.ts';
import type { Meeting, MeetingDraft, Speaker, TranscriptSegment } from './types.ts';
import { createId } from '../utils/id.ts';

export function createMeeting(draft: MeetingDraft): Meeting {
  const now = new Date().toISOString();
  const id = createId('mtg');
  const speaker: Speaker = {
    id: createId('spk'), meetingId: id, displayName: 'Speaker 1',
    isNamed: false, isEnrolled: false, createdAt: now
  };
  return {
    id, title: draft.title.trim() || 'Untitled meeting', status: 'draft', runtime: draft.runtime,
    startedAt: now, createdAt: now, updatedAt: now, sourceLanguage: draft.sourceLanguage,
    translationMode: draft.translationMode,
    consentAcknowledgedAt: draft.consentAcknowledged ? now : undefined,
    speakers: [speaker], segments: [], keywordDefinitions: definitionsFromTerms(draft.keywords),
    keywordOccurrences: [], insights: [], bookmarks: [], metrics: emptyMeetingMetrics
  };
}
export function ensureSpeaker(meeting: Meeting, requestedId?: string): { meeting: Meeting; speaker: Speaker } {
  const existing = requestedId ? meeting.speakers.find((item) => item.id === requestedId) : meeting.speakers[0];
  if (existing) return { meeting, speaker: existing };
  const speaker: Speaker = {
    id: requestedId ?? createId('spk'), meetingId: meeting.id,
    displayName: `Speaker ${meeting.speakers.length + 1}`, isNamed: false,
    isEnrolled: false, createdAt: new Date().toISOString()
  };
  return { meeting: { ...meeting, speakers: [...meeting.speakers, speaker] }, speaker };
}
export function addFinalSegment(meeting: Meeting, incoming: TranscriptSegment): Meeting {
  const ensured = ensureSpeaker(meeting, incoming.speakerId);
  const segments = [...ensured.meeting.segments.filter((segment) => segment.id !== incoming.id), incoming]
    .sort((a, b) => a.startMs - b.startMs);
  const keywordOccurrences = [
    ...ensured.meeting.keywordOccurrences.filter((item) => item.segmentId !== incoming.id),
    ...occurrencesForSegment(meeting.id, incoming, ensured.meeting.keywordDefinitions)
  ];
  const insights = deduplicateInsights([
    ...ensured.meeting.insights.filter((item) => item.segmentId !== incoming.id),
    ...extractInsights(meeting.id, incoming, ensured.meeting.speakers)
  ]);
  return {
    ...ensured.meeting, status: 'recording', segments, keywordOccurrences, insights,
    metrics: calculateMeetingMetrics(segments, ensured.meeting.speakers.length, insights),
    summary: generateSummary(segments, insights), updatedAt: new Date().toISOString()
  };
}
export function renameSpeaker(meeting: Meeting, speakerId: string, displayName: string): Meeting {
  const name = displayName.trim();
  if (!name) return meeting;
  return {
    ...meeting,
    speakers: meeting.speakers.map((speaker) => speaker.id === speakerId ? { ...speaker, displayName: name, isNamed: true } : speaker),
    updatedAt: new Date().toISOString()
  };
}
export function addBookmark(meeting: Meeting, startMs: number, note?: string): Meeting {
  return {
    ...meeting,
    bookmarks: [...meeting.bookmarks, { id: createId('mark'), meetingId: meeting.id, startMs, note, createdAt: new Date().toISOString() }],
    updatedAt: new Date().toISOString()
  };
}
export function finishMeeting(meeting: Meeting, audioUri?: string): Meeting {
  const endedAt = new Date().toISOString();
  const durationMs = Math.max(
    meeting.metrics.durationMs,
    new Date(endedAt).getTime() - new Date(meeting.startedAt).getTime()
  );
  return {
    ...meeting, status: 'complete', endedAt, audioUri: audioUri ?? meeting.audioUri,
    updatedAt: endedAt,
    metrics: calculateMeetingMetrics(meeting.segments, meeting.speakers.length, meeting.insights, durationMs),
    summary: generateSummary(meeting.segments, meeting.insights)
  };
}
