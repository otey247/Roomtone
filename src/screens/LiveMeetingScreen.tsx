import { useEffect, useMemo, useRef, useState } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { TranscriptRow } from '../components/TranscriptRow.tsx';
import type { Meeting, TranscriptSegment } from '../domain/types.ts';
import type { RuntimeStatus } from '../inference/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';
import { formatDuration } from '../utils/time.ts';

interface LiveMeetingScreenProps {
  meeting?: Meeting;
  partialSegment?: TranscriptSegment;
  runtimeStatus: RuntimeStatus;
  runtimeDetail?: string;
  audioLevel: number;
  error?: string;
  onBookmark(): void;
  onStop(): Promise<Meeting | undefined>;
  onComplete(meetingId: string): void;
  onBack(): void;
  keepScreenAwake: boolean;
}

export function LiveMeetingScreen({
  meeting,
  partialSegment,
  runtimeStatus,
  runtimeDetail,
  audioLevel,
  error,
  onBookmark,
  onStop,
  onComplete,
  onBack,
  keepScreenAwake
}: LiveMeetingScreenProps) {
  const [now, setNow] = useState(Date.now());
  const [stopping, setStopping] = useState(false);
  const listRef = useRef<FlatList<TranscriptSegment>>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!keepScreenAwake) return undefined;
    void activateKeepAwakeAsync('roomtone-live');
    return () => { void deactivateKeepAwake('roomtone-live'); };
  }, [keepScreenAwake]);

  const elapsed = meeting ? Math.max(0, now - new Date(meeting.startedAt).getTime()) : 0;
  const rows = useMemo(() => {
    const finalRows = meeting?.segments.filter((segment) => segment.isFinal) ?? [];
    return partialSegment ? [...finalRows, partialSegment] : finalRows;
  }, [meeting?.segments, partialSegment]);

  useEffect(() => {
    if (rows.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [rows.length, partialSegment?.originalText]);

  const finish = async () => {
    if (stopping) return;
    setStopping(true);
    const completed = await onStop();
    if (completed) onComplete(completed.id);
    else onBack();
  };

  if (!meeting) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Meeting session unavailable</Text>
        <Button label="Return home" onPress={onBack} />
      </View>
    );
  }

  const statusLabel = runtimeStatus === 'recording'
    ? 'LIVE'
    : runtimeStatus === 'preparing'
      ? 'PREPARING'
      : runtimeStatus === 'processing'
        ? 'FINALIZING'
        : runtimeStatus.toLocaleUpperCase();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{statusLabel}</Text>
          <Text style={styles.time}>{formatDuration(elapsed)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.title}>{meeting.title}</Text>
        <Text numberOfLines={1} style={styles.runtime}>{runtimeDetail ?? (meeting.runtime === 'demo' ? 'Guided demo' : 'On-device audio')}</Text>
      </View>

      <View style={styles.meter} accessibilityLabel={`Microphone activity ${Math.round(audioLevel * 100)} percent`}>
        {Array.from({ length: 18 }, (_, index) => {
          const threshold = (index + 1) / 18;
          const active = audioLevel >= threshold * 0.86;
          return <View key={index} style={[styles.meterBar, { height: 7 + ((index * 11) % 23) }, active && styles.meterBarActive]} />;
        })}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(segment) => `${segment.id}-${segment.isFinal ? 'final' : 'partial'}`}
        contentContainerStyle={rows.length ? styles.transcriptContent : styles.emptyTranscript}
        renderItem={({ item }) => {
          const speakerName = meeting.speakers.find((speaker) => speaker.id === item.speakerId)?.displayName ?? 'Speaker';
          return <TranscriptRow segment={item} speakerName={speakerName} keywords={meeting.keywordDefinitions} isPartial={!item.isFinal} />;
        }}
        ListEmptyComponent={(
          <View style={styles.listening}>
            <Text style={styles.listeningTitle}>{runtimeStatus === 'preparing' ? 'Preparing local models' : 'Listening for speech'}</Text>
            <Text style={styles.listeningText}>The transcript will appear here. Keep the phone close enough to hear every participant clearly.</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Button label="Bookmark" variant="secondary" disabled={stopping} style={styles.footerButton} onPress={onBookmark} />
        <Button label={stopping ? 'Finalizing' : 'End meeting'} loading={stopping} style={styles.footerButton} onPress={() => void finish()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: palette.canvas },
  centerTitle: { ...typography.heading, color: palette.ink, textAlign: 'center' },
  header: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.xxs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveDot: { width: 9, height: 9, borderRadius: radius.round, backgroundColor: palette.destructive },
  liveText: { ...typography.eyebrow, color: palette.ink },
  time: { ...typography.mono, color: palette.inkSubtle },
  title: { ...typography.subheading, color: palette.ink, maxWidth: '92%' },
  runtime: { ...typography.meta, color: palette.inkSubtle },
  meter: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  meterBar: { width: 4, borderRadius: radius.round, backgroundColor: palette.lineStrong },
  meterBarActive: { backgroundColor: palette.dark },
  error: { ...typography.meta, color: palette.destructive, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  transcriptContent: { paddingBottom: spacing.lg },
  emptyTranscript: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  listening: { alignItems: 'center', gap: spacing.sm },
  listeningTitle: { ...typography.subheading, color: palette.ink },
  listeningText: { ...typography.body, color: palette.inkSubtle, textAlign: 'center', maxWidth: 420 },
  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: palette.surface },
  footerButton: { flex: 1 }
});
