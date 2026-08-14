import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

export interface SegmentOption<T extends string> { value: T; label: string }

export function SegmentedControl<T extends string>({ value, options, onChange }: { value: T; options: SegmentOption<T>[]; onChange(value: T): void }) {
  return (
    <View style={styles.root} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={[styles.item, selected && styles.selected]}>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, padding: 3, gap: 3 },
  item: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  selected: { backgroundColor: palette.dark },
  label: { ...typography.meta, color: palette.inkSubtle, textAlign: 'center' },
  selectedLabel: { color: palette.onDark, fontWeight: '700' }
});
