import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CalendarEventContext, MeetingDraft, TranscriptCitation } from '../domain/types.ts';
import { BottomNav, type RootTab } from '../components/BottomNav.tsx';
import type { WorkspaceTab } from '../components/WorkspaceTabs.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { AskScreen } from '../screens/AskScreen.tsx';
import { CalendarScreen } from '../screens/CalendarScreen.tsx';
import { HomeScreen } from '../screens/HomeScreen.tsx';
import { ImportScreen } from '../screens/ImportScreen.tsx';
import { LibraryScreen } from '../screens/LibraryScreen.tsx';
import { LiveMeetingScreen } from '../screens/LiveMeetingScreen.tsx';
import { MeetingDetailScreen } from '../screens/MeetingDetailScreen.tsx';
import { NewMeetingScreen } from '../screens/NewMeetingScreen.tsx';
import { SettingsScreen } from '../screens/SettingsScreen.tsx';
import { palette } from '../theme/tokens.ts';
import { useRoomtone } from './RoomtoneContext.tsx';

type Route =
  | { kind: 'tabs'; tab: RootTab }
  | { kind: 'new'; mode: 'meeting' | 'voice_note'; calendarEvent?: CalendarEventContext }
  | { kind: 'import' }
  | { kind: 'live' }
  | { kind: 'detail'; meetingId: string; tab?: WorkspaceTab; seekMs?: number };

export function RoomtoneApp() {
  const roomtone = useRoomtone();
  const [route, setRoute] = useState<Route>({ kind: 'tabs', tab: 'home' });

  if (!roomtone.ready) return <LoadingState />;

  const startMeeting = async (draft: MeetingDraft) => {
    await roomtone.startMeeting(draft);
    setRoute({ kind: 'live' });
  };
  const openCitation = (citation: TranscriptCitation) => {
    setRoute({ kind: 'detail', meetingId: citation.meetingId, tab: 'transcript', seekMs: citation.startMs });
  };

  let content: ReactNode;
  if (route.kind === 'new') {
    content = <NewMeetingScreen
      settings={roomtone.settings}
      models={roomtone.models}
      mode={route.mode}
      calendarEvent={route.calendarEvent}
      onBack={() => setRoute({ kind: 'tabs', tab: route.calendarEvent ? 'calendar' : 'home' })}
      onStart={startMeeting}
    />;
  } else if (route.kind === 'import') {
    content = <ImportScreen
      models={roomtone.models}
      activeModelId={roomtone.settings.activeSpeechModelId}
      onBack={() => setRoute({ kind: 'tabs', tab: 'home' })}
      onImportLocal={roomtone.importLocalMedia}
      onImportRemote={roomtone.importRemoteMedia}
      onOpenSession={(meetingId) => setRoute({ kind: 'detail', meetingId, tab: 'transcript' })}
    />;
  } else if (route.kind === 'live') {
    content = <LiveMeetingScreen
      meeting={roomtone.activeMeeting}
      partialSegment={roomtone.partialSegment}
      runtimeStatus={roomtone.runtimeStatus}
      runtimeDetail={roomtone.runtimeDetail}
      audioLevel={roomtone.audioLevel}
      error={roomtone.sessionError}
      onBookmark={() => roomtone.addBookmark()}
      onStop={roomtone.stopMeeting}
      onComplete={(meetingId) => setRoute({ kind: 'detail', meetingId, tab: 'summary' })}
      onBack={() => setRoute({ kind: 'tabs', tab: 'home' })}
      keepScreenAwake={roomtone.settings.keepScreenAwake}
    />;
  } else if (route.kind === 'detail') {
    const meeting = roomtone.meetings.find((item) => item.id === route.meetingId);
    content = <MeetingDetailScreen
      meeting={meeting}
      initialTab={route.tab}
      initialSeekMs={route.seekMs}
      onBack={() => setRoute({ kind: 'tabs', tab: 'library' })}
      onRenameSpeaker={(speakerId, displayName) => roomtone.renameSpeaker(route.meetingId, speakerId, displayName)}
      onDelete={async () => { await roomtone.deleteMeeting(route.meetingId); setRoute({ kind: 'tabs', tab: 'library' }); }}
      onAddNote={(text, linkedStartMs) => roomtone.addNote(route.meetingId, text, linkedStartMs)}
      onUpdateNote={(noteId, text) => roomtone.updateNote(route.meetingId, noteId, text)}
      onDeleteNote={(noteId) => roomtone.deleteNote(route.meetingId, noteId)}
      onAsk={(question) => roomtone.askSession(route.meetingId, question)}
      onUpdateInsight={(insightId, patch) => roomtone.updateInsight(route.meetingId, insightId, patch)}
    />;
  } else {
    const tabContent = route.tab === 'home'
      ? <HomeScreen
          meetings={roomtone.meetings}
          onRecordMeeting={() => setRoute({ kind: 'new', mode: 'meeting' })}
          onVoiceNote={() => setRoute({ kind: 'new', mode: 'voice_note' })}
          onImport={() => setRoute({ kind: 'import' })}
          onCalendar={() => setRoute({ kind: 'tabs', tab: 'calendar' })}
          onOpenMeeting={(meetingId) => setRoute({ kind: 'detail', meetingId })}
          onOpenLibrary={() => setRoute({ kind: 'tabs', tab: 'library' })}
        />
      : route.tab === 'library'
        ? <LibraryScreen meetings={roomtone.meetings} onOpenMeeting={(meetingId) => setRoute({ kind: 'detail', meetingId })} />
        : route.tab === 'ask'
          ? <AskScreen onAsk={async (question) => (await roomtone.askLibrary(question)).messages} onOpenCitation={openCitation} />
          : route.tab === 'calendar'
            ? <CalendarScreen loadEvents={roomtone.loadCalendarEvents} onStartEvent={(calendarEvent) => setRoute({ kind: 'new', mode: 'meeting', calendarEvent })} />
            : <SettingsScreen settings={roomtone.settings} models={roomtone.models} onUpdateSettings={roomtone.updateSettings} onInstallModel={roomtone.installModel} onRemoveModel={roomtone.removeModel} onLoadSamples={roomtone.loadSampleMeetings} />;
    content = <View style={styles.tabRoot}><View style={styles.tabContent}>{tabContent}</View><BottomNav active={route.tab} onChange={(tab) => setRoute({ kind: 'tabs', tab })} /></View>;
  }

  return <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  tabRoot: { flex: 1 },
  tabContent: { flex: 1 }
});
