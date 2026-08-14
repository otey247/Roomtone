import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { MeetingRow } from '../components/MeetingRow.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import { SectionHeader } from '../components/SectionHeader.tsx';
import type { Meeting } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

interface HomeScreenProps {
  meetings: Meeting[];
  onNewMeeting(): void;
  onOpenMeeting(meetingId: string): void;
  onOpenLibrary(): void;
}

export function HomeScreen({ meetings, onNewMeeting, onOpenMeeting, onOpenLibrary }: HomeScreenProps) {
  const recent = meetings.slice(0, 3);
  const actionCount = meetings.reduce((total, meeting) => total + meeting.metrics.actionCount, 0);
  const decisionCount = meetings.reduce((total, meeting) => total + meeting.metrics.decisionCount, 0);

  return (
    <ScrollScreen>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandLetter}>R</Text></View>
        <Text style={styles.brand}>Roomtone</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Local meeting intelligence</Text>
        <Text style={styles.title}>Meetings that remember.</Text>
        <Text style={styles.intro}>Capture a visibly consented conversation, follow the transcript live, and turn outcomes into evidence-linked notes without requiring a Roomtone cloud account.</Text>
        <Button label="Start a meeting" fullWidth onPress={onNewMeeting} />
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>{meetings.length}</Text><Text style={styles.metricLabel}>Meetings</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{actionCount}</Text><Text style={styles.metricLabel}>Actions</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{decisionCount}</Text><Text style={styles.metricLabel}>Decisions</Text></View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent meetings" detail={recent.length ? 'Stored locally on this device' : 'Your completed meetings will appear here'} />
        {recent.length ? (
          <View style={styles.list}>
            {recent.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onPress={() => onOpenMeeting(meeting.id)} />)}
            <Button label="Open library" variant="secondary" fullWidth onPress={onOpenLibrary} />
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No meetings yet</Text>
            <Text style={styles.emptyText}>Use Guided demo to explore the complete workflow in Expo Go, or install local speech models for on-device audio.</Text>
          </View>
        )}
      </View>

      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>Designed for visible, local capture</Text>
        <Text style={styles.privacyText}>Recording state stays visible. Source text and translations are stored separately. Automated outcomes link back to transcript timestamps.</Text>
      </View>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  brandMark: { width: 34, height: 34, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.dark },
  brandLetter: { ...typography.bodyStrong, color: palette.onDark },
  brand: { ...typography.subheading, color: palette.ink },
  hero: { gap: spacing.md, marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  title: { ...typography.title, color: palette.ink, maxWidth: 520 },
  intro: { ...typography.body, color: palette.inkSubtle, maxWidth: 660 },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl },
  metric: { flex: 1, minHeight: 96, justifyContent: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
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
