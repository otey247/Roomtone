import { addFinalSegment, createMeeting, finishMeeting } from '../domain/meeting.ts';
import type { Meeting, Speaker, TranscriptSegment } from '../domain/types.ts';

export interface DemoScriptEntry {
  speakerKey: 'jo' | 'sarah' | 'mike';
  startMs: number;
  endMs: number;
  originalText: string;
  translatedText?: string;
}

export const demoScript: DemoScriptEntry[] = [
  {
    speakerKey: 'jo', startMs: 0, endMs: 7_400,
    originalText: 'Thanks for joining. Today we need to confirm the launch scope, security dependency, and owner for the client walkthrough.'
  },
  {
    speakerKey: 'sarah', startMs: 8_100, endMs: 16_900,
    originalText: 'The mobile experience is ready for review, but private connectivity remains a risk for the enterprise deployment.'
  },
  {
    speakerKey: 'mike', startMs: 17_600, endMs: 25_700,
    originalText: 'Does the security team require a separate service identity for the transcription runtime?'
  },
  {
    speakerKey: 'jo', startMs: 26_400, endMs: 35_900,
    originalText: 'We agreed to keep all meeting audio and analysis on the phone by default. Cloud synchronization will be a separate opt-in capability.'
  },
  {
    speakerKey: 'sarah', startMs: 36_700, endMs: 45_800,
    originalText: 'I will send the architecture and privacy review to Guard by Friday.'
  },
  {
    speakerKey: 'mike', startMs: 46_600, endMs: 55_200,
    originalText: 'I will validate background recording on iOS and Android before August 21.'
  },
  {
    speakerKey: 'sarah', startMs: 56_100, endMs: 64_400,
    originalText: 'También debemos validar la traducción al inglés para reuniones multilingües.',
    translatedText: 'We also need to validate English translation for multilingual meetings.'
  },
  {
    speakerKey: 'jo', startMs: 65_200, endMs: 74_900,
    originalText: 'The decision is to proceed with a local-first beta after those device checks pass. Let us schedule the launch review for next week.'
  },
  {
    speakerKey: 'mike', startMs: 75_600, endMs: 81_700,
    originalText: 'Who will own the final App Store privacy disclosure?'
  }
];

function buildSpeakers(meetingId: string, createdAt: string): Record<DemoScriptEntry['speakerKey'], Speaker> {
  return {
    jo: { id: `${meetingId}_jo`, meetingId, displayName: 'Jo', isNamed: true, isEnrolled: false, createdAt },
    sarah: { id: `${meetingId}_sarah`, meetingId, displayName: 'Sarah', isNamed: true, isEnrolled: false, createdAt },
    mike: { id: `${meetingId}_mike`, meetingId, displayName: 'Mike', isNamed: true, isEnrolled: false, createdAt }
  };
}

export function demoSegment(meetingId: string, speakerId: string, index: number, entry: DemoScriptEntry): TranscriptSegment {
  const now = new Date().toISOString();
  return {
    id: `${meetingId}_seg_${index + 1}`,
    meetingId,
    speakerId,
    startMs: entry.startMs,
    endMs: entry.endMs,
    originalText: entry.originalText,
    translatedText: entry.translatedText,
    originalLanguage: entry.translatedText ? 'es' : 'en',
    confidence: 0.92,
    isFinal: true,
    words: [],
    transcriptionVersion: 1,
    diarizationVersion: 1,
    createdAt: now,
    updatedAt: now
  };
}

export function buildDemoMeeting(): Meeting {
  const base = createMeeting({
    title: 'Client launch readiness',
    runtime: 'demo',
    sourceLanguage: 'auto',
    translationMode: 'english',
    keywords: ['security', 'launch', 'privacy', 'translation'],
    consentAcknowledged: true
  });
  const speakers = buildSpeakers(base.id, base.createdAt);
  let meeting: Meeting = { ...base, startedAt: new Date(Date.now() - 86_000).toISOString(), speakers: Object.values(speakers) };
  demoScript.forEach((entry, index) => {
    meeting = addFinalSegment(meeting, demoSegment(meeting.id, speakers[entry.speakerKey].id, index, entry));
  });
  return finishMeeting(meeting);
}

function rekeyMeeting(meeting: Meeting, suffix: string, title: string, offsetMs: number): Meeting {
  const id = `${meeting.id}_${suffix}`;
  const speakerMap = new Map(meeting.speakers.map((speaker) => [speaker.id, `${speaker.id}_${suffix}`]));
  const segmentMap = new Map(meeting.segments.map((segment) => [segment.id, `${segment.id}_${suffix}`]));
  const shiftedStartedAt = new Date(new Date(meeting.startedAt).getTime() + offsetMs).toISOString();
  const shiftedEndedAt = meeting.endedAt ? new Date(new Date(meeting.endedAt).getTime() + offsetMs).toISOString() : undefined;
  return {
    ...meeting,
    id,
    title,
    startedAt: shiftedStartedAt,
    endedAt: shiftedEndedAt,
    createdAt: shiftedStartedAt,
    updatedAt: shiftedEndedAt ?? shiftedStartedAt,
    speakers: meeting.speakers.map((speaker) => ({ ...speaker, id: speakerMap.get(speaker.id)!, meetingId: id })),
    segments: meeting.segments.map((segment) => ({ ...segment, id: segmentMap.get(segment.id)!, meetingId: id, speakerId: speakerMap.get(segment.speakerId)! })),
    keywordDefinitions: meeting.keywordDefinitions.map((keyword) => ({ ...keyword, id: `${keyword.id}_${suffix}` })),
    keywordOccurrences: meeting.keywordOccurrences.map((occurrence) => ({
      ...occurrence,
      id: `${occurrence.id}_${suffix}`,
      meetingId: id,
      segmentId: segmentMap.get(occurrence.segmentId)!,
      keywordId: `${occurrence.keywordId}_${suffix}`
    })),
    insights: meeting.insights.map((insight) => ({ ...insight, id: `${insight.id}_${suffix}`, meetingId: id, segmentId: segmentMap.get(insight.segmentId)! })),
    bookmarks: meeting.bookmarks.map((bookmark) => ({ ...bookmark, id: `${bookmark.id}_${suffix}`, meetingId: id })),
    metrics: { ...meeting.metrics }
  };
}

export function buildRecentDemoMeetings(): Meeting[] {
  const source = buildDemoMeeting();
  return [
    rekeyMeeting(source, 'launch', 'Client launch readiness', 0),
    rekeyMeeting(source, 'retro', 'Weekly product retrospective', -86_400_000)
  ];
}
