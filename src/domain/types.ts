export type MeetingStatus = 'draft' | 'recording' | 'processing' | 'complete';
export type InsightKind = 'decision' | 'action' | 'question' | 'risk' | 'commitment';
export type RuntimeKind = 'demo' | 'native';
export type TranslationMode = 'off' | 'english';
export type ExportTemplate = 'brief' | 'minutes' | 'transcript' | 'actions';

export interface WordTiming { text: string; startMs: number; endMs: number; confidence?: number }
export interface Speaker {
  id: string; meetingId: string; displayName: string; isNamed: boolean;
  isEnrolled: boolean; createdAt: string;
}
export interface TranscriptSegment {
  id: string; meetingId: string; speakerId: string; startMs: number; endMs: number;
  originalText: string; translatedText?: string; originalLanguage: string;
  confidence: number; isFinal: boolean; words: WordTiming[];
  transcriptionVersion: number; diarizationVersion: number;
  createdAt: string; updatedAt: string;
}
export interface KeywordDefinition { id: string; term: string; aliases: string[]; enabled: boolean }
export interface KeywordOccurrence {
  id: string; meetingId: string; keywordId: string; segmentId: string;
  matchedText: string; startCharacter: number; endCharacter: number; startMs: number;
}
export interface Insight {
  id: string; meetingId: string; segmentId: string; kind: InsightKind; text: string;
  owner?: string; dueText?: string; evidenceStartMs: number; confidence: number;
  resolved: boolean; createdAt: string;
}
export interface Bookmark { id: string; meetingId: string; startMs: number; note?: string; createdAt: string }
export interface MeetingMetrics {
  durationMs: number; totalTurns: number; questionCount: number; decisionCount: number;
  actionCount: number; actionsWithOwner: number; actionsWithDueDate: number;
  longestTurnMs: number; speakerCount: number; averageTurnMs: number;
}
export interface Meeting {
  id: string; title: string; status: MeetingStatus; runtime: RuntimeKind;
  startedAt: string; endedAt?: string; createdAt: string; updatedAt: string;
  sourceLanguage: string; translationMode: TranslationMode; consentAcknowledgedAt?: string;
  audioUri?: string; speakers: Speaker[]; segments: TranscriptSegment[];
  keywordDefinitions: KeywordDefinition[]; keywordOccurrences: KeywordOccurrence[];
  insights: Insight[]; bookmarks: Bookmark[]; summary?: string; metrics: MeetingMetrics;
}
export interface MeetingDraft {
  title: string; runtime: RuntimeKind; sourceLanguage: string;
  translationMode: TranslationMode; keywords: string[]; consentAcknowledged: boolean;
}
export interface AppSettings {
  defaultRuntime: RuntimeKind; defaultLanguage: string;
  defaultTranslationMode: TranslationMode; deleteAudioAfterDays: number | null;
  deleteMeetingsAfterDays: number | null; keepScreenAwake: boolean;
  activeSpeechModelId: string; consentReminderEnabled: boolean;
}
export interface ModelDescriptor {
  id: string; title: string; description: string; filename: string; url: string;
  approximateBytes: number; sha256?: string; role: 'speech' | 'vad';
  language: 'english' | 'multilingual' | 'none'; supportsSpeakerTurns: boolean;
  resourceClass: 'light' | 'standard' | 'heavy';
}
export interface ModelState extends ModelDescriptor {
  installed: boolean; localUri?: string; downloadProgress: number;
  downloading: boolean; error?: string;
}
export interface SearchResult { meeting: Meeting; matchingSegmentIds: string[] }
