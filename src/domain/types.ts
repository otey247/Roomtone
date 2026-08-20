export type MeetingStatus = 'draft' | 'recording' | 'processing' | 'complete' | 'failed';
export type InsightKind = 'decision' | 'action' | 'question' | 'risk' | 'commitment';
export type RuntimeKind = 'demo' | 'native';
export type TranslationMode = 'off' | 'english';
export type ExportTemplate = 'brief' | 'minutes' | 'transcript' | 'actions';
export type SessionKind = 'meeting' | 'voice_note' | 'lecture' | 'interview' | 'media';
export type SessionSourceKind =
  | 'live_microphone'
  | 'voice_note'
  | 'audio_upload'
  | 'video_upload'
  | 'remote_url'
  | 'calendar_event'
  | 'guided_demo';
export type SessionSourceProvider =
  | 'device'
  | 'youtube'
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'
  | 'sharepoint'
  | 'calendar'
  | 'direct_url'
  | 'unknown';
export type SessionProcessingStatus = 'ready' | 'queued' | 'normalizing' | 'transcribing' | 'analyzing' | 'complete' | 'failed';
export type SummaryProfile = 'business' | 'lecture' | 'interview' | 'voice_note' | 'media';
export type ChatScope = 'session' | 'library';

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
export interface SessionSource {
  kind: SessionSourceKind;
  provider: SessionSourceProvider;
  displayName?: string;
  uri?: string;
  originalUri?: string;
  normalizedAudioUri?: string;
  mimeType?: string;
  sizeBytes?: number;
  externalUrl?: string;
  importedAt: string;
  processingStatus: SessionProcessingStatus;
  progress: number;
  error?: string;
}
export interface CalendarEventContext {
  id: string;
  calendarId: string;
  calendarTitle?: string;
  title: string;
  startAt: string;
  endAt: string;
  organizer?: string;
  attendees: string[];
  location?: string;
  notes?: string;
  meetingUrl?: string;
}
export interface EvidenceReference {
  meetingId: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  quote?: string;
}
export interface SummaryItem {
  id: string;
  text: string;
  label?: string;
  evidence: EvidenceReference[];
}
export interface StructuredSummary {
  profile: SummaryProfile;
  generatedAt: string;
  executiveSummary: string;
  topics: SummaryItem[];
  keyMoments: SummaryItem[];
  decisions: SummaryItem[];
  actionItems: SummaryItem[];
  openQuestions: SummaryItem[];
  risks: SummaryItem[];
  followUps: SummaryItem[];
  notableQuotes: SummaryItem[];
}
export interface SessionNote {
  id: string;
  meetingId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  linkedStartMs?: number;
}
export interface TranscriptCitation {
  meetingId: string;
  meetingTitle: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  quote: string;
  speakerName?: string;
}
export interface ChatMessage {
  id: string;
  meetingId?: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  scope: ChatScope;
  citations: TranscriptCitation[];
}
export interface GroundedAnswer {
  text: string;
  citations: TranscriptCitation[];
  confidence: number;
}
export interface Meeting {
  id: string; title: string; status: MeetingStatus; runtime: RuntimeKind;
  startedAt: string; endedAt?: string; createdAt: string; updatedAt: string;
  sourceLanguage: string; translationMode: TranslationMode; consentAcknowledgedAt?: string;
  audioUri?: string; speakers: Speaker[]; segments: TranscriptSegment[];
  keywordDefinitions: KeywordDefinition[]; keywordOccurrences: KeywordOccurrence[];
  insights: Insight[]; bookmarks: Bookmark[]; summary?: string; metrics: MeetingMetrics;
  kind?: SessionKind;
  source?: SessionSource;
  calendarEvent?: CalendarEventContext;
  structuredSummary?: StructuredSummary;
  notes?: SessionNote[];
  chat?: ChatMessage[];
  tags?: string[];
}
export type Session = Meeting;
export interface MeetingDraft {
  title: string; runtime: RuntimeKind; sourceLanguage: string;
  translationMode: TranslationMode; keywords: string[]; consentAcknowledged: boolean;
  kind?: SessionKind;
  source?: SessionSource;
  calendarEvent?: CalendarEventContext;
  tags?: string[];
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
