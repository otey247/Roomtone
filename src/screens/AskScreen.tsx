import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import type { ChatMessage, TranscriptCitation } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';
import { formatTimestamp } from '../utils/time.ts';

interface AskScreenProps {
  onAsk(question: string): Promise<ChatMessage[]>;
  onOpenCitation(citation: TranscriptCitation): void;
}

const prompts = [
  'What commitments are still open?',
  'What issues around authentication keep coming up?',
  'Show decisions from my recent sessions.',
  'What did clients say about launch timing?'
];

export function AskScreen({ onAsk, onOpenCitation }: AskScreenProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (value = query) => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(undefined);
    setQuery('');
    try {
      const exchange = await onAsk(trimmed);
      setMessages((current) => [...current, ...exchange]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Roomtone could not search the local session library.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Across your local library</Text>
          <Text style={styles.title}>Ask Roomtone</Text>
          <Text style={styles.detail}>Search every stored session for evidence. Answers use transcript text and captured outcomes, and unsupported questions return no evidence rather than a fabricated response.</Text>
        </View>

        {!messages.length ? (
          <View style={styles.prompts}>
            <Text style={styles.promptHeading}>Try asking</Text>
            {prompts.map((prompt) => <Pressable key={prompt} onPress={() => void submit(prompt)} style={styles.prompt}><Text style={styles.promptText}>{prompt}</Text></Pressable>)}
          </View>
        ) : null}

        <View style={styles.messages}>
          {messages.map((message) => <MessageBubble key={message.id} message={message} onOpenCitation={onOpenCitation} />)}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Ask across all sessions"
          value={query}
          onChangeText={setQuery}
          placeholder="Ask about decisions, commitments, people, or recurring topics"
          placeholderTextColor={palette.inkFaint}
          multiline
          style={styles.input}
        />
        <Button label="Ask" loading={busy} disabled={!query.trim() || busy} onPress={() => void submit()} />
      </View>
    </KeyboardAvoidingView>
  );
}

export function MessageBubble({ message, onOpenCitation }: { message: ChatMessage; onOpenCitation(citation: TranscriptCitation): void }) {
  const assistant = message.role === 'assistant';
  return (
    <View style={[styles.message, assistant ? styles.assistantMessage : styles.userMessage]}>
      <Text style={[styles.messageRole, !assistant && styles.userRole]}>{assistant ? 'Roomtone' : 'You'}</Text>
      <Text style={[styles.messageText, !assistant && styles.userText]}>{message.text}</Text>
      {assistant && message.citations.length ? (
        <View style={styles.citations}>
          {message.citations.map((citation, index) => (
            <Pressable key={`${citation.meetingId}:${citation.segmentId}:${index}`} onPress={() => onOpenCitation(citation)} style={styles.citation}>
              <Text style={styles.citationTime}>{citation.meetingTitle} · {formatTimestamp(citation.startMs)}</Text>
              <Text numberOfLines={2} style={styles.citationQuote}>{citation.speakerName ? `${citation.speakerName}: ` : ''}{citation.quote}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heading: { gap: spacing.xs, marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  title: { ...typography.title, color: palette.ink },
  detail: { ...typography.body, color: palette.inkSubtle },
  prompts: { gap: spacing.sm, marginBottom: spacing.xl },
  promptHeading: { ...typography.subheading, color: palette.ink },
  prompt: { minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface },
  promptText: { ...typography.body, color: palette.ink },
  messages: { gap: spacing.md },
  message: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg },
  assistantMessage: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  userMessage: { alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: palette.dark },
  messageRole: { ...typography.eyebrow, color: palette.inkSubtle },
  userRole: { color: palette.onDarkSubtle },
  messageText: { ...typography.body, color: palette.ink },
  userText: { color: palette.onDark },
  citations: { gap: spacing.xs, marginTop: spacing.sm },
  citation: { gap: spacing.xxs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  citationTime: { ...typography.meta, color: palette.primary, fontWeight: '700' },
  citationQuote: { ...typography.meta, color: palette.inkSubtle },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: palette.surface },
  input: { flex: 1, minHeight: 48, maxHeight: 120, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surfaceRaised, ...typography.body, color: palette.ink },
  error: { ...typography.body, color: palette.destructive, marginTop: spacing.md }
});
