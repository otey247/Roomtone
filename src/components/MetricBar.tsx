import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

export function MetricBar({ label, value, detail }: { label: string; value: number; detail: string }) {
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View style={styles.root}>
      <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.detail}>{detail}</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { ...typography.bodyStrong, color: palette.ink },
  detail: { ...typography.meta, color: palette.inkSubtle },
  track: { height: 7, borderRadius: radius.round, backgroundColor: palette.line },
  fill: { height: 7, borderRadius: radius.round, backgroundColor: palette.dark }
});
