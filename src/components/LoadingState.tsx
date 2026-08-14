import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type as typography } from '../theme/tokens.ts';

export function LoadingState({ label = 'Loading Roomtone' }: { label?: string }) {
  return <View style={styles.root}><ActivityIndicator color={palette.ink} /><Text style={styles.label}>{label}</Text></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: palette.canvas }, label: { ...typography.body, color: palette.inkSubtle } });
