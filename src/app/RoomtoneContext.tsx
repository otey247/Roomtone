import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAudioStream } from 'expo-audio';
import {
  addNote as addMeetingNote,
  appendChatMessages,
  createMeeting,
  deleteNote as deleteMeetingNote,
  renameSpeaker as renameMeetingSpeaker,
  updateInsight as updateMeetingInsight,
  updateNote as updateMeetingNote
} from '../domain/meeting.ts';
import { answerLibraryQuestion, answerSessionQuestion, createChatExchange } from '../domain/transcript-chat.ts';
import type {
  AppSettings,
  CalendarEventContext,
  ChatMessage,
  GroundedAnswer,
  Insight,
  Meeting,
  MeetingDraft,
  ModelState
} from '../domain/types.ts';
import { buildRecentDemoMeetings } from '../data/demo.ts';
import { ExpoAudioStreamAdapter, type ExpoAudioStreamBuffer } from '../inference/expo-audio-stream-adapter.ts';
import { modelManager } from '../inference/model-manager.ts';
import { loadUpcomingCalendarEvents } from '../infrastructure/calendar.ts';
import { pickMediaDocument, processImportedSession, stagePickedMedia, stageRemoteMedia } from '../infrastructure/media-import.ts';
import {
  defaultSettings,
  deleteMeeting as deleteStoredMeeting,
  enforceRetention,
  initializeRepository,
  listMeetings,
  loadSettings,
  saveMeeting,
  saveSettings as persistSettings
} from '../infrastructure/meeting-repository.ts';
import { useMeetingSession } from '../hooks/useMeetingSession.ts';

interface RoomtoneContextValue {
  ready: boolean;
  meetings: Meeting[];
  settings: AppSettings;
  models: ModelState[];
  activeMeeting?: Meeting;
  partialSegment: ReturnType<typeof useMeetingSession>['partialSegment'];
  runtimeStatus: ReturnType<typeof useMeetingSession>['runtimeStatus'];
  runtimeDetail?: string;
  audioLevel: number;
  sessionError?: string;
  startMeeting(draft: MeetingDraft): Promise<Meeting>;
  stopMeeting(): Promise<Meeting | undefined>;
  clearSession(): Promise<void>;
  addBookmark(note?: string): void;
  renameSpeaker(meetingId: string, speakerId: string, displayName: string): Promise<void>;
  deleteMeeting(id: string): Promise<void>;
  addNote(meetingId: string, text: string, linkedStartMs?: number): Promise<void>;
  updateNote(meetingId: string, noteId: string, text: string): Promise<void>;
  deleteNote(meetingId: string, noteId: string): Promise<void>;
  updateInsight(meetingId: string, insightId: string, patch: Partial<Pick<Insight, 'owner' | 'dueText' | 'resolved' | 'text'>>): Promise<void>;
  askSession(meetingId: string, question: string): Promise<ChatMessage[]>;
  askLibrary(question: string): Promise<{ answer: GroundedAnswer; messages: ChatMessage[] }>;
  importLocalMedia(): Promise<Meeting | undefined>;
  importRemoteMedia(url: string, title?: string): Promise<Meeting>;
  loadCalendarEvents(): Promise<CalendarEventContext[]>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  installModel(id: string): Promise<void>;
  removeModel(id: string): Promise<void>;
  loadSampleMeetings(): Promise<void>;
  refresh(): Promise<void>;
}

const RoomtoneContext = createContext<RoomtoneContextValue | undefined>(undefined);

export function RoomtoneProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [models, setModels] = useState<ModelState[]>(modelManager.list());
  const audioAdapterRef = useRef(new ExpoAudioStreamAdapter());
  const audioStream = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: 'int16',
    onBuffer: (buffer: ExpoAudioStreamBuffer) => audioAdapterRef.current.push(buffer)
  });
  useEffect(() => { audioAdapterRef.current.attach(audioStream.stream); }, [audioStream.stream]);

  const updateMeetingInMemory = useCallback((meeting: Meeting) => {
    setMeetings((current) => [meeting, ...current.filter((item) => item.id !== meeting.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);
  const persistMeeting = useCallback(async (meeting: Meeting) => {
    await saveMeeting(meeting);
    updateMeetingInMemory(meeting);
  }, [updateMeetingInMemory]);
  const session = useMeetingSession(updateMeetingInMemory, audioAdapterRef.current);

  const refresh = useCallback(async () => setMeetings(await listMeetings()), []);

  useEffect(() => {
    const unsubscribe = modelManager.subscribe(setModels);
    void (async () => {
      await initializeRepository();
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);
      await enforceRetention(loadedSettings);
      await Promise.all([refresh(), modelManager.initialize()]);
      setReady(true);
    })();
    return unsubscribe;
  }, [refresh]);

  const startMeeting = useCallback(async (draft: MeetingDraft) => {
    const speech = models.find((model) => model.id === settings.activeSpeechModelId);
    const vad = models.find((model) => model.role === 'vad');
    return session.start(draft, { speech, vad });
  }, [models, session, settings.activeSpeechModelId]);

  const meetingById = useCallback((meetingId: string) => {
    return session.meeting?.id === meetingId ? session.meeting : meetings.find((item) => item.id === meetingId);
  }, [meetings, session.meeting]);

  const renameSpeaker = useCallback(async (meetingId: string, speakerId: string, displayName: string) => {
    if (session.meeting?.id === meetingId) {
      session.renameSpeaker(speakerId, displayName);
      return;
    }
    const meeting = meetings.find((item) => item.id === meetingId);
    if (!meeting) return;
    await persistMeeting(renameMeetingSpeaker(meeting, speakerId, displayName));
  }, [meetings, persistMeeting, session]);

  const deleteMeeting = useCallback(async (id: string) => {
    if (session.meeting?.id === id) await session.clear();
    await deleteStoredMeeting(id);
    setMeetings((current) => current.filter((meeting) => meeting.id !== id));
  }, [session]);

  const mutateMeeting = useCallback(async (meetingId: string, mutate: (meeting: Meeting) => Meeting) => {
    const meeting = meetingById(meetingId);
    if (!meeting) return;
    await persistMeeting(mutate(meeting));
  }, [meetingById, persistMeeting]);

  const addNote = useCallback((meetingId: string, text: string, linkedStartMs?: number) => {
    return mutateMeeting(meetingId, (meeting) => addMeetingNote(meeting, text, linkedStartMs));
  }, [mutateMeeting]);
  const updateNote = useCallback((meetingId: string, noteId: string, text: string) => {
    return mutateMeeting(meetingId, (meeting) => updateMeetingNote(meeting, noteId, text));
  }, [mutateMeeting]);
  const deleteNote = useCallback((meetingId: string, noteId: string) => {
    return mutateMeeting(meetingId, (meeting) => deleteMeetingNote(meeting, noteId));
  }, [mutateMeeting]);
  const updateInsight = useCallback((meetingId: string, insightId: string, patch: Partial<Pick<Insight, 'owner' | 'dueText' | 'resolved' | 'text'>>) => {
    return mutateMeeting(meetingId, (meeting) => updateMeetingInsight(meeting, insightId, patch));
  }, [mutateMeeting]);

  const askSession = useCallback(async (meetingId: string, question: string): Promise<ChatMessage[]> => {
    const meeting = meetingById(meetingId);
    if (!meeting) throw new Error('The selected session could not be found.');
    const answer = answerSessionQuestion(meeting, question);
    const messages = createChatExchange(meeting.id, question, answer, 'session');
    await persistMeeting(appendChatMessages(meeting, messages));
    return messages;
  }, [meetingById, persistMeeting]);

  const askLibrary = useCallback(async (question: string) => {
    const answer = answerLibraryQuestion(meetings, question);
    return { answer, messages: createChatExchange(undefined, question, answer, 'library') };
  }, [meetings]);

  const processInBackground = useCallback((meeting: Meeting) => {
    const speech = models.find((model) => model.id === settings.activeSpeechModelId);
    if (!speech) return;
    void processImportedSession(meeting, speech, persistMeeting).catch(() => undefined);
  }, [models, persistMeeting, settings.activeSpeechModelId]);

  const importLocalMedia = useCallback(async () => {
    const picked = await pickMediaDocument();
    if (!picked) return undefined;
    const meeting = createMeeting({
      title: picked.name.replace(/\.[a-zA-Z0-9]{1,8}$/, ''),
      runtime: 'native',
      sourceLanguage: settings.defaultLanguage,
      translationMode: settings.defaultTranslationMode,
      keywords: [],
      consentAcknowledged: true,
      kind: 'media'
    });
    const stagedSource = await stagePickedMedia(meeting.id, picked);
    const staged = { ...meeting, status: 'processing' as const, source: stagedSource, updatedAt: new Date().toISOString() };
    await persistMeeting(staged);
    processInBackground(staged);
    return staged;
  }, [persistMeeting, processInBackground, settings.defaultLanguage, settings.defaultTranslationMode]);

  const importRemoteMedia = useCallback(async (url: string, title?: string) => {
    const meeting = createMeeting({
      title: title?.trim() || 'Imported media',
      runtime: 'native',
      sourceLanguage: settings.defaultLanguage,
      translationMode: settings.defaultTranslationMode,
      keywords: [],
      consentAcknowledged: true,
      kind: 'media'
    });
    const stagedSource = await stageRemoteMedia(meeting.id, url, title);
    const staged = { ...meeting, title: title?.trim() || stagedSource.displayName || meeting.title, status: 'processing' as const, source: stagedSource, updatedAt: new Date().toISOString() };
    await persistMeeting(staged);
    processInBackground(staged);
    return staged;
  }, [persistMeeting, processInBackground, settings.defaultLanguage, settings.defaultTranslationMode]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await persistSettings(updated);
  }, [settings]);

  const loadSampleMeetings = useCallback(async () => {
    for (const meeting of buildRecentDemoMeetings()) await saveMeeting(meeting);
    await refresh();
  }, [refresh]);

  const value = useMemo<RoomtoneContextValue>(() => ({
    ready,
    meetings,
    settings,
    models,
    activeMeeting: session.meeting,
    partialSegment: session.partialSegment,
    runtimeStatus: session.runtimeStatus,
    runtimeDetail: session.runtimeDetail,
    audioLevel: session.audioLevel,
    sessionError: session.error,
    startMeeting,
    stopMeeting: session.stop,
    clearSession: session.clear,
    addBookmark: session.addBookmark,
    renameSpeaker,
    deleteMeeting,
    addNote,
    updateNote,
    deleteNote,
    updateInsight,
    askSession,
    askLibrary,
    importLocalMedia,
    importRemoteMedia,
    loadCalendarEvents: loadUpcomingCalendarEvents,
    updateSettings,
    installModel: (id) => modelManager.install(id),
    removeModel: (id) => modelManager.remove(id),
    loadSampleMeetings,
    refresh
  }), [ready, meetings, settings, models, session, startMeeting, renameSpeaker, deleteMeeting, addNote, updateNote, deleteNote, updateInsight, askSession, askLibrary, importLocalMedia, importRemoteMedia, updateSettings, loadSampleMeetings, refresh]);

  return <RoomtoneContext.Provider value={value}>{children}</RoomtoneContext.Provider>;
}

export function useRoomtone(): RoomtoneContextValue {
  const context = useContext(RoomtoneContext);
  if (!context) throw new Error('useRoomtone must be used inside RoomtoneProvider.');
  return context;
}
