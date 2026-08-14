import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Meeting } from '../domain/types.ts';
import { formatDuration, formatRelativeMeetingDate } from '../utils/time.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

export function MeetingRow({ meeting, onPress }: { meeting: Meeting; onPress(): void }) {
  const outcomes = meeting.metrics.decisionCount + meeting.metrics.actionCount;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
      <View style={styles.topLine}>
        <Text numberOfLines={2} style={styles.title}>{meeting.title}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      <Text style={styles.meta}>{formatRelativeMeetingDate(meeting.startedAt)} · {formatDuration(meeting.metrics.durationMs)} · {meeting.speakers.length} speaker{meeting.speakers.length === 1 ? '' : 's'}</Text>
      <View style={styles.footer}>
        <Text style={styles.outcome}>{meeting.metrics.actionCount} actions</Text>
        <Text style={styles.separator}>·</Text>
        <Text style={styles.outcome}>{meeting.metrics.decisionCount} decisions</Text>
        {outcomes === 0 ? <Text style={styles.outcome}>Transcript only</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  pressed: { opacity: 0.68 },
  topLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.subheading, flex: 1, color: palette.ink },
  chevron: { fontSize: 28, lineHeight: 28, color: palette.inkSubtle },
  meta: { ...typography.meta, color: palette.inkSubtle },
  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  outcome: { ...typography.meta, color: palette.ink },
  separator: { color: palette.inkFaint }
});
