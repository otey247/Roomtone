import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'quiet' | 'destructive';
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({ label, variant = 'primary', loading = false, fullWidth = false, disabled, style, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' || variant === 'quiet' ? palette.ink : palette.onDark} /> : (
        <Text style={[styles.label, variant === 'secondary' || variant === 'quiet' ? styles.darkLabel : styles.lightLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.42 },
  label: { ...typography.bodyStrong },
  lightLabel: { color: palette.onDark },
  darkLabel: { color: palette.ink }
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: palette.dark, borderColor: palette.dark },
  secondary: { backgroundColor: palette.surface, borderColor: palette.lineStrong },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  destructive: { backgroundColor: palette.destructive, borderColor: palette.destructive }
});
