import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { MeetingRow } from '../components/MeetingRow.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import { SectionHeader } from '../components/SectionHeader.tsx';
import type { Meeting } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

interface HomeScreenProps {
  meetings: Meeting[];
  onRecordMeeting(): void;
  onVoiceNote(): void;
  onImport(): void;
  onCalendar(): void;
  onOpenMeeting(meetingId: string): void;
  onOpenLibrary(): void;
}

export function HomeScreen({ meetings, onRecordMeeting, onVoiceNote, onImport, onCalendar, onOpenMeeting, onOpenLibrary }: HomeScreenProps) {
  const recent = meetings.slice(0, 4);
  const openActions = meetings.reduce((total, meeting) => total + meeting.insights.filter((insight) => insight.kind === 'action' && !insight.resolved).length, 0);
  const processing = meetings.filter((meeting) => meeting.status === 'processing').length;

  return (
    <ScrollScreen>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandLetter}>R</Text></View>
        <View><Text style={styles.brand}>Roomtone</Text><Text style={styles.brandMeta}>Local session intelligence</Text></View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Capture → understand → act</Text>
        <Text style={styles.title}>Every conversation becomes a workspace.</Text>
        <Text style={styles.intro}>Record live meetings and voice notes, import existing media, connect calendar context, and return to transcript-grounded answers, notes, actions, and evidence.</Text>
      </View>

      <View style={styles.actions}>
        <QuickAction title="Record meeting" detail="Live transcript and outcomes" mark="R" onPress={onRecordMeeting} primary />
        <QuickAction title="Voice note" detail="Offline thoughts and interviews" mark="V" onPress={onVoiceNote} />
        <QuickAction title="Import media" detail="Audio, video, Drive and Files" mark="I" onPress={onImport} />
        <QuickAction title="Upcoming" detail="Start with calendar context" mark="C" onPress={onCalendar} />
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>{meetings.length}</Text><Text style={styles.metricLabel}>Sessions</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{openActions}</Text><Text style={styles.metricLabel}>Open actions</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{processing}</Text><Text style={styles.metricLabel}>Processing</Text></View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent sessions" detail={recent.length ? 'Stored locally on this device' : 'Record or import your first session'} />
        {recent.length ? (
          <View style={styles.list}>
            {recent.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onPress={() => onOpenMeeting(meeting.id)} />)}
            <Button label="Open all sessions" variant="secondary" fullWidth onPress={onOpenLibrary} />
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your session library is empty</Text>
            <Text style={styles.emptyText}>Use Guided demo to explore without a model, or install local speech models in Settings for microphone and media transcription.</Text>
          </View>
        )}
      </View>

      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>Evidence first</Text>
        <Text style={styles.privacyText}>Automated answers and outcomes link to the underlying transcript timestamp. Recording state stays visible, and the default workflow remains on the phone.</Text>
      </View>
    </ScrollScreen>
  );
}

function QuickAction({ title, detail, mark, onPress, primary = false }: { title: string; detail: string; mark: string; onPress(): void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, primary && styles.primaryAction]}>
      <View style={[styles.actionMark, primary && styles.primaryActionMark]}><Text style={[styles.actionMarkText, primary && styles.primaryActionMarkText]}>{mark}</Text></View>
      <Text style={[styles.actionTitle, primary && styles.primaryActionTitle]}>{title}</Text>
      <Text style={[styles.actionDetail, primary && styles.primaryActionDetail]}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  brandMark: { width: 38, height: 38, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.dark },
  brandLetter: { ...typography.bodyStrong, color: palette.onDark },
  brand: { ...typography.subheading, color: palette.ink },
  brandMeta: { ...typography.meta, color: palette.inkSubtle },
  hero: { gap: spacing.md, marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  title: { ...typography.title, color: palette.ink, maxWidth: 620 },
  intro: { ...typography.body, color: palette.inkSubtle, maxWidth: 680 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  action: { width: '47%', flexGrow: 1, minHeight: 142, padding: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.lg, backgroundColor: palette.surface, gap: spacing.xs },
  primaryAction: { backgroundColor: palette.dark, borderColor: palette.dark },
  actionMark: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, borderWidth: 1, borderColor: palette.lineStrong },
  primaryActionMark: { borderColor: '#5D5D5D' },
  actionMarkText: { ...typography.meta, color: palette.ink, fontWeight: '700' },
  primaryActionMarkText: { color: palette.onDark },
  actionTitle: { ...typography.bodyStrong, color: palette.ink, marginTop: spacing.xs },
  primaryActionTitle: { color: palette.onDark },
  actionDetail: { ...typography.meta, color: palette.inkSubtle },
  primaryActionDetail: { color: palette.onDarkSubtle },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl },
  metric: { flex: 1, minHeight: 90, justifyContent: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  metricValue: { ...typography.heading, color: palette.ink },
  metricLabel: { ...typography.meta, color: palette.inkSubtle, marginTop: spacing.xxs },
  section: { gap: spacing.md },
  list: { gap: spacing.sm },
  empty: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, gap: spacing.sm },
  emptyTitle: { ...typography.subheading, color: palette.ink },
  emptyText: { ...typography.body, color: palette.inkSubtle },
  privacy: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, gap: spacing.xs },
  privacyTitle: { ...typography.bodyStrong, color: palette.ink },
  privacyText: { ...typography.body, color: palette.inkSubtle }
});
