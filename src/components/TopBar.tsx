import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type as typography } from '../theme/tokens.ts';

interface TopBarProps { title: string; subtitle?: string; onBack?: () => void; actionLabel?: string; onAction?: () => void }

export function TopBar({ title, subtitle, onBack, actionLabel, onAction }: TopBarProps) {
  return (
    <View style={styles.root}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable> : <View style={styles.backPlaceholder} />}
      <View style={styles.titleGroup}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}><Text style={styles.action}>{actionLabel}</Text></Pressable> : <View style={styles.actionPlaceholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, backgroundColor: palette.canvas },
  back: { width: 36, height: 44, justifyContent: 'center' },
  backPlaceholder: { width: 36 },
  backText: { color: palette.ink, fontSize: 38, lineHeight: 40, fontWeight: '400' },
  titleGroup: { flex: 1, alignItems: 'center' },
  title: { ...typography.subheading, color: palette.ink },
  subtitle: { ...typography.meta, color: palette.inkSubtle },
  action: { ...typography.bodyStrong, color: palette.primary },
  actionPlaceholder: { width: 36 }
});
