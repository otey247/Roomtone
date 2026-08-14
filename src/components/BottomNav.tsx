import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type as typography } from '../theme/tokens.ts';

export type RootTab = 'home' | 'library' | 'settings';
const tabs: Array<{ id: RootTab; label: string; mark: string }> = [
  { id: 'home', label: 'Home', mark: 'R' },
  { id: 'library', label: 'Library', mark: 'L' },
  { id: 'settings', label: 'Settings', mark: 'S' }
];

export function BottomNav({ active, onChange }: { active: RootTab; onChange(tab: RootTab): void }) {
  return (
    <View style={styles.root}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(tab.id)} style={styles.item}>
            <View style={[styles.mark, selected && styles.selectedMark]}><Text style={[styles.markText, selected && styles.selectedMarkText]}>{tab.mark}</Text></View>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 78, flexDirection: 'row', paddingBottom: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: palette.surface },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs, minHeight: 58 },
  mark: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.lineStrong },
  selectedMark: { backgroundColor: palette.dark, borderColor: palette.dark },
  markText: { ...typography.meta, color: palette.inkSubtle, fontWeight: '700' },
  selectedMarkText: { color: palette.onDark },
  label: { ...typography.meta, color: palette.inkSubtle },
  selectedLabel: { color: palette.ink, fontWeight: '700' }
});
