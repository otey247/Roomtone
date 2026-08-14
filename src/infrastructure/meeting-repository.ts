import * as FileSystem from 'expo-file-system/legacy';
import { meetingSearchText, type MeetingEvent } from '../domain/events.ts';
import type { AppSettings, Meeting, SearchResult } from '../domain/types.ts';
import { getDatabase } from './database.ts';

const SETTINGS_KEY = 'settings';

export const defaultSettings: AppSettings = {
  defaultRuntime: 'demo',
  defaultLanguage: 'auto',
  defaultTranslationMode: 'off',
  deleteAudioAfterDays: null,
  deleteMeetingsAfterDays: null,
  keepScreenAwake: true,
  activeSpeechModelId: 'whisper-tiny-multilingual-q5-1',
  consentReminderEnabled: true
};

export async function initializeRepository(): Promise<void> {
  await getDatabase();
}

export async function listMeetings(): Promise<Meeting[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ payload: string }>('SELECT payload FROM meetings ORDER BY updated_at DESC');
  return rows.flatMap((row) => {
    try { return [JSON.parse(row.payload) as Meeting]; } catch { return []; }
  });
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ payload: string }>('SELECT payload FROM meetings WHERE id = ?', id);
  if (!row) return undefined;
  try { return JSON.parse(row.payload) as Meeting; } catch { return undefined; }
}

export async function saveMeeting(meeting: Meeting): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO meetings(id, title, started_at, updated_at, status, search_text, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       started_at = excluded.started_at,
       updated_at = excluded.updated_at,
       status = excluded.status,
       search_text = excluded.search_text,
       payload = excluded.payload`,
    meeting.id,
    meeting.title,
    meeting.startedAt,
    meeting.updatedAt,
    meeting.status,
    meetingSearchText(meeting),
    JSON.stringify(meeting)
  );
}

export async function deleteMeeting(id: string): Promise<void> {
  const existing = await getMeeting(id);
  if (existing?.audioUri) {
    await FileSystem.deleteAsync(existing.audioUri, { idempotent: true }).catch(() => undefined);
  }
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM meeting_events WHERE meeting_id = ?', id);
    await database.runAsync('DELETE FROM meetings WHERE id = ?', id);
  });
}

export async function appendMeetingEvent(meetingId: string, event: MeetingEvent): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO meeting_events(meeting_id, occurred_at, event_type, payload) VALUES (?, ?, ?, ?)',
    meetingId,
    event.occurredAt,
    event.type,
    JSON.stringify(event)
  );
}

export async function searchMeetings(query: string): Promise<SearchResult[]> {
  const normalized = query.trim().toLocaleLowerCase();
  const meetings = await listMeetings();
  if (!normalized) return meetings.map((meeting) => ({ meeting, matchingSegmentIds: [] }));
  return meetings.flatMap((meeting) => {
    const matchingSegmentIds = meeting.segments.filter((segment) =>
      segment.originalText.toLocaleLowerCase().includes(normalized)
      || segment.translatedText?.toLocaleLowerCase().includes(normalized)
    ).map((segment) => segment.id);
    const generalMatch = meeting.title.toLocaleLowerCase().includes(normalized)
      || meeting.summary?.toLocaleLowerCase().includes(normalized)
      || meeting.speakers.some((speaker) => speaker.displayName.toLocaleLowerCase().includes(normalized))
      || meeting.insights.some((insight) => insight.text.toLocaleLowerCase().includes(normalized));
    return generalMatch || matchingSegmentIds.length ? [{ meeting, matchingSegmentIds }] : [];
  });
}

export async function loadSettings(): Promise<AppSettings> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ payload: string }>('SELECT payload FROM app_state WHERE key = ?', SETTINGS_KEY);
  if (!row) return defaultSettings;
  try { return { ...defaultSettings, ...(JSON.parse(row.payload) as Partial<AppSettings>) }; }
  catch { return defaultSettings; }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO app_state(key, payload, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    SETTINGS_KEY,
    JSON.stringify(settings),
    new Date().toISOString()
  );
}

export async function enforceRetention(settings: AppSettings): Promise<void> {
  const meetings = await listMeetings();
  const now = Date.now();
  for (const meeting of meetings) {
    if (settings.deleteAudioAfterDays && meeting.audioUri) {
      const ageDays = (now - new Date(meeting.updatedAt).getTime()) / 86_400_000;
      if (ageDays >= settings.deleteAudioAfterDays) {
        await FileSystem.deleteAsync(meeting.audioUri, { idempotent: true }).catch(() => undefined);
        await saveMeeting({ ...meeting, audioUri: undefined });
      }
    }
    if (settings.deleteMeetingsAfterDays) {
      const ageDays = (now - new Date(meeting.updatedAt).getTime()) / 86_400_000;
      if (ageDays >= settings.deleteMeetingsAfterDays) await deleteMeeting(meeting.id);
    }
  }
}
