import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

export type WorkspaceTab = 'transcript' | 'summary' | 'ask' | 'notes' | 'actions' | 'insights';

const options: Array<{ value: WorkspaceTab; label: string }> = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'summary', label: 'Summary' },
  { value: 'ask', label: 'Ask' },
  { value: 'notes', label: 'Notes' },
  { value: 'actions', label: 'Actions' },
  { value: 'insights', label: 'Insights' }
];

export function WorkspaceTabs({ value, onChange }: { value: WorkspaceTab; onChange(value: WorkspaceTab): void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} style={styles.root}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.tab, selected && styles.selectedTab]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, backgroundColor: palette.canvas },
  content: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tab: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.round, borderWidth: 1, borderColor: palette.lineStrong, backgroundColor: palette.surface },
  selectedTab: { backgroundColor: palette.dark, borderColor: palette.dark },
  label: { ...typography.meta, color: palette.inkSubtle, fontWeight: '600' },
  selectedLabel: { color: palette.onDark }
});
