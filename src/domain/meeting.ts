import { calculateMeetingMetrics, emptyMeetingMetrics } from './analytics.ts';
import { deduplicateInsights, extractInsights, generateSummary } from './insights.ts';
import { definitionsFromTerms, occurrencesForSegment } from './keywords.ts';
import { buildStructuredSummary } from './session-analysis.ts';
import type {
  ChatMessage,
  Insight,
  Meeting,
  MeetingDraft,
  SessionNote,
  SessionSource,
  Speaker,
  TranscriptSegment
} from './types.ts';
import { createId } from '../utils/id.ts';

function defaultSource(draft: MeetingDraft, now: string): SessionSource {
  if (draft.source) return draft.source;
  return {
    kind: draft.runtime === 'demo' ? 'guided_demo' : draft.kind === 'voice_note' ? 'voice_note' : 'live_microphone',
    provider: 'device',
    importedAt: now,
    processingStatus: draft.runtime === 'demo' ? 'complete' : 'ready',
    progress: draft.runtime === 'demo' ? 1 : 0
  };
}

export function createMeeting(draft: MeetingDraft): Meeting {
  const now = new Date().toISOString();
  const id = createId('mtg');
  const speaker: Speaker = {
    id: createId('spk'), meetingId: id, displayName: 'Speaker 1',
    isNamed: false, isEnrolled: false, createdAt: now
  };
  return {
    id, title: draft.title.trim() || 'Untitled session', status: 'draft', runtime: draft.runtime,
    startedAt: now, createdAt: now, updatedAt: now, sourceLanguage: draft.sourceLanguage,
    translationMode: draft.translationMode,
    consentAcknowledgedAt: draft.consentAcknowledged ? now : undefined,
    speakers: [speaker], segments: [], keywordDefinitions: definitionsFromTerms(draft.keywords),
    keywordOccurrences: [], insights: [], bookmarks: [], metrics: emptyMeetingMetrics,
    kind: draft.kind ?? 'meeting',
    source: defaultSource(draft, now),
    calendarEvent: draft.calendarEvent,
    notes: [],
    chat: [],
    tags: draft.tags ?? []
  };
}

export function normalizeMeeting(meeting: Meeting): Meeting {
  const now = meeting.createdAt || meeting.startedAt || new Date().toISOString();
  const normalized: Meeting = {
    ...meeting,
    kind: meeting.kind ?? 'meeting',
    source: meeting.source ?? {
      kind: meeting.runtime === 'demo' ? 'guided_demo' : 'live_microphone',
      provider: 'device',
      importedAt: now,
      processingStatus: meeting.status === 'complete' ? 'complete' : 'ready',
      progress: meeting.status === 'complete' ? 1 : 0
    },
    notes: meeting.notes ?? [],
    chat: meeting.chat ?? [],
    tags: meeting.tags ?? []
  };
  return normalized.structuredSummary
    ? normalized
    : { ...normalized, structuredSummary: buildStructuredSummary(normalized) };
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
  const ensured = ensureSpeaker(normalizeMeeting(meeting), incoming.speakerId);
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
  const next: Meeting = {
    ...ensured.meeting, status: 'recording', segments, keywordOccurrences, insights,
    metrics: calculateMeetingMetrics(segments, ensured.meeting.speakers.length, insights),
    summary: generateSummary(segments, insights), updatedAt: new Date().toISOString()
  };
  return { ...next, structuredSummary: buildStructuredSummary(next) };
}

export function replaceTranscript(meeting: Meeting, speakers: Speaker[], segments: TranscriptSegment[]): Meeting {
  let next = normalizeMeeting({ ...meeting, speakers, segments: [], insights: [], keywordOccurrences: [] });
  for (const segment of segments.sort((a, b) => a.startMs - b.startMs)) next = addFinalSegment(next, segment);
  return next;
}

export function renameSpeaker(meeting: Meeting, speakerId: string, displayName: string): Meeting {
  const name = displayName.trim();
  if (!name) return meeting;
  const next: Meeting = {
    ...normalizeMeeting(meeting),
    speakers: meeting.speakers.map((speaker) => speaker.id === speakerId ? { ...speaker, displayName: name, isNamed: true } : speaker),
    updatedAt: new Date().toISOString()
  };
  return { ...next, structuredSummary: buildStructuredSummary(next) };
}

export function addBookmark(meeting: Meeting, startMs: number, note?: string): Meeting {
  const next: Meeting = {
    ...normalizeMeeting(meeting),
    bookmarks: [...meeting.bookmarks, { id: createId('mark'), meetingId: meeting.id, startMs, note, createdAt: new Date().toISOString() }],
    updatedAt: new Date().toISOString()
  };
  return { ...next, structuredSummary: buildStructuredSummary(next) };
}

export function addNote(meeting: Meeting, text: string, linkedStartMs?: number): Meeting {
  const trimmed = text.trim();
  if (!trimmed) return meeting;
  const now = new Date().toISOString();
  const note: SessionNote = {
    id: createId('note'),
    meetingId: meeting.id,
    text: trimmed,
    createdAt: now,
    updatedAt: now,
    linkedStartMs
  };
  return { ...normalizeMeeting(meeting), notes: [...(meeting.notes ?? []), note], updatedAt: now };
}

export function updateNote(meeting: Meeting, noteId: string, text: string): Meeting {
  const trimmed = text.trim();
  if (!trimmed) return deleteNote(meeting, noteId);
  const now = new Date().toISOString();
  return {
    ...normalizeMeeting(meeting),
    notes: (meeting.notes ?? []).map((note) => note.id === noteId ? { ...note, text: trimmed, updatedAt: now } : note),
    updatedAt: now
  };
}

export function deleteNote(meeting: Meeting, noteId: string): Meeting {
  return {
    ...normalizeMeeting(meeting),
    notes: (meeting.notes ?? []).filter((note) => note.id !== noteId),
    updatedAt: new Date().toISOString()
  };
}

export function appendChatMessages(meeting: Meeting, messages: ChatMessage[]): Meeting {
  if (!messages.length) return meeting;
  return {
    ...normalizeMeeting(meeting),
    chat: [...(meeting.chat ?? []), ...messages],
    updatedAt: new Date().toISOString()
  };
}

export function updateInsight(meeting: Meeting, insightId: string, patch: Partial<Pick<Insight, 'owner' | 'dueText' | 'resolved' | 'text'>>): Meeting {
  const next: Meeting = {
    ...normalizeMeeting(meeting),
    insights: meeting.insights.map((insight) => insight.id === insightId ? { ...insight, ...patch } : insight),
    updatedAt: new Date().toISOString()
  };
  return {
    ...next,
    metrics: calculateMeetingMetrics(next.segments, next.speakers.length, next.insights, next.metrics.durationMs),
    summary: generateSummary(next.segments, next.insights),
    structuredSummary: buildStructuredSummary(next)
  };
}

export function updateSource(meeting: Meeting, patch: Partial<SessionSource>): Meeting {
  const current = normalizeMeeting(meeting).source!;
  return {
    ...normalizeMeeting(meeting),
    source: { ...current, ...patch },
    status: patch.processingStatus === 'failed' ? 'failed' : meeting.status,
    updatedAt: new Date().toISOString()
  };
}

export function finishMeeting(meeting: Meeting, audioUri?: string): Meeting {
  const normalized = normalizeMeeting(meeting);
  const endedAt = new Date().toISOString();
  const durationMs = Math.max(
    normalized.metrics.durationMs,
    new Date(endedAt).getTime() - new Date(normalized.startedAt).getTime()
  );
  const next: Meeting = {
    ...normalized, status: 'complete', endedAt, audioUri: audioUri ?? normalized.audioUri,
    source: normalized.source ? { ...normalized.source, processingStatus: 'complete', progress: 1 } : normalized.source,
    updatedAt: endedAt,
    metrics: calculateMeetingMetrics(normalized.segments, normalized.speakers.length, normalized.insights, durationMs),
    summary: generateSummary(normalized.segments, normalized.insights)
  };
  return { ...next, structuredSummary: buildStructuredSummary(next) };
}
