import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAudioStream } from 'expo-audio';
import { renameSpeaker as renameMeetingSpeaker } from '../domain/meeting.ts';
import type { AppSettings, Meeting, MeetingDraft, ModelState } from '../domain/types.ts';
import { buildRecentDemoMeetings } from '../data/demo.ts';
import { ExpoAudioStreamAdapter, type ExpoAudioStreamBuffer } from '../inference/expo-audio-stream-adapter.ts';
import { modelManager } from '../inference/model-manager.ts';
import { defaultSettings, deleteMeeting as deleteStoredMeeting, enforceRetention, initializeRepository, listMeetings, loadSettings, saveMeeting, saveSettings as persistSettings } from '../infrastructure/meeting-repository.ts';
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

  const renameSpeaker = useCallback(async (meetingId: string, speakerId: string, displayName: string) => {
    if (session.meeting?.id === meetingId) {
      session.renameSpeaker(speakerId, displayName);
      return;
    }
    const meeting = meetings.find((item) => item.id === meetingId);
    if (!meeting) return;
    const updated = renameMeetingSpeaker(meeting, speakerId, displayName);
    await saveMeeting(updated);
    updateMeetingInMemory(updated);
  }, [meetings, session, updateMeetingInMemory]);

  const deleteMeeting = useCallback(async (id: string) => {
    if (session.meeting?.id === id) await session.clear();
    await deleteStoredMeeting(id);
    setMeetings((current) => current.filter((meeting) => meeting.id !== id));
  }, [session]);

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
    updateSettings,
    installModel: (id) => modelManager.install(id),
    removeModel: (id) => modelManager.remove(id),
    loadSampleMeetings,
    refresh
  }), [ready, meetings, settings, models, session, startMeeting, renameSpeaker, deleteMeeting, updateSettings, loadSampleMeetings, refresh]);

  return <RoomtoneContext.Provider value={value}>{children}</RoomtoneContext.Provider>;
}

export function useRoomtone(): RoomtoneContextValue {
  const context = useContext(RoomtoneContext);
  if (!context) throw new Error('useRoomtone must be used inside RoomtoneProvider.');
  return context;
}
