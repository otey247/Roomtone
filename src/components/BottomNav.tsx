import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type as typography } from '../theme/tokens.ts';

export type RootTab = 'home' | 'library' | 'ask' | 'calendar' | 'settings';
const tabs: Array<{ id: RootTab; label: string; mark: string }> = [
  { id: 'home', label: 'Home', mark: 'H' },
  { id: 'library', label: 'Sessions', mark: 'S' },
  { id: 'ask', label: 'Ask', mark: 'A' },
  { id: 'calendar', label: 'Calendar', mark: 'C' },
  { id: 'settings', label: 'Settings', mark: 'R' }
];

export function BottomNav({ active, onChange }: { active: RootTab; onChange(tab: RootTab): void }) {
  return (
    <View style={styles.root}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={styles.item}
          >
            <View style={[styles.mark, selected && styles.selectedMark]}>
              <Text style={[styles.markText, selected && styles.selectedMarkText]}>{tab.mark}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.label, selected && styles.selectedLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 76,
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    backgroundColor: palette.surface
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 58, paddingHorizontal: 2 },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.lineStrong },
  selectedMark: { backgroundColor: palette.dark, borderColor: palette.dark },
  markText: { fontSize: 11, lineHeight: 14, color: palette.inkSubtle, fontWeight: '700' },
  selectedMarkText: { color: palette.onDark },
  label: { ...typography.meta, fontSize: 11, lineHeight: 14, color: palette.inkSubtle },
  selectedLabel: { color: palette.ink, fontWeight: '700' }
});
