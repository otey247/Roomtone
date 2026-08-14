import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { palette, spacing } from '../theme/tokens.ts';

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.content}>{children}</View>;
}

export function ScrollScreen({ children, contentContainerStyle, ...props }: ScrollViewProps & { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scrollContent, contentContainerStyle]} {...props}>{children}</ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, backgroundColor: palette.canvas },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 }
});
