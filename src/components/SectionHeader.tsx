import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type as typography } from '../theme/tokens.ts';

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return <View style={styles.root}><Text style={styles.title}>{title}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>;
}

const styles = StyleSheet.create({ root: { gap: spacing.xxs }, title: { ...typography.subheading, color: palette.ink }, detail: { ...typography.body, color: palette.inkSubtle } });
