import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MeetingDraft } from '../domain/types.ts';
import { BottomNav, type RootTab } from '../components/BottomNav.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { HomeScreen } from '../screens/HomeScreen.tsx';
import { LibraryScreen } from '../screens/LibraryScreen.tsx';
import { LiveMeetingScreen } from '../screens/LiveMeetingScreen.tsx';
import { MeetingDetailScreen } from '../screens/MeetingDetailScreen.tsx';
import { NewMeetingScreen } from '../screens/NewMeetingScreen.tsx';
import { SettingsScreen } from '../screens/SettingsScreen.tsx';
import { palette } from '../theme/tokens.ts';
import { useRoomtone } from './RoomtoneContext.tsx';

type Route =
  | { kind: 'tabs'; tab: RootTab }
  | { kind: 'new' }
  | { kind: 'live' }
  | { kind: 'detail'; meetingId: string };

export function RoomtoneApp() {
  const roomtone = useRoomtone();
  const [route, setRoute] = useState<Route>({ kind: 'tabs', tab: 'home' });

  if (!roomtone.ready) return <LoadingState />;

  const startMeeting = async (draft: MeetingDraft) => {
    await roomtone.startMeeting(draft);
    setRoute({ kind: 'live' });
  };

  let content: ReactNode;
  if (route.kind === 'new') {
    content = <NewMeetingScreen settings={roomtone.settings} models={roomtone.models} onBack={() => setRoute({ kind: 'tabs', tab: 'home' })} onStart={startMeeting} />;
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
      onComplete={(meetingId) => setRoute({ kind: 'detail', meetingId })}
      onBack={() => setRoute({ kind: 'tabs', tab: 'home' })}
      keepScreenAwake={roomtone.settings.keepScreenAwake}
    />;
  } else if (route.kind === 'detail') {
    const meeting = roomtone.meetings.find((item) => item.id === route.meetingId);
    content = <MeetingDetailScreen
      meeting={meeting}
      onBack={() => setRoute({ kind: 'tabs', tab: 'library' })}
      onRenameSpeaker={(speakerId, displayName) => roomtone.renameSpeaker(route.meetingId, speakerId, displayName)}
      onDelete={async () => { await roomtone.deleteMeeting(route.meetingId); setRoute({ kind: 'tabs', tab: 'library' }); }}
    />;
  } else {
    const tabContent = route.tab === 'home'
      ? <HomeScreen meetings={roomtone.meetings} onNewMeeting={() => setRoute({ kind: 'new' })} onOpenMeeting={(meetingId) => setRoute({ kind: 'detail', meetingId })} onOpenLibrary={() => setRoute({ kind: 'tabs', tab: 'library' })} />
      : route.tab === 'library'
        ? <LibraryScreen meetings={roomtone.meetings} onOpenMeeting={(meetingId) => setRoute({ kind: 'detail', meetingId })} />
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
