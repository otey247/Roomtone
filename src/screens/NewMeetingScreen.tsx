import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import { SegmentedControl } from '../components/SegmentedControl.tsx';
import { TopBar } from '../components/TopBar.tsx';
import type { AppSettings, MeetingDraft, ModelState, RuntimeKind, TranslationMode } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

interface NewMeetingScreenProps {
  settings: AppSettings;
  models: ModelState[];
  onBack(): void;
  onStart(draft: MeetingDraft): Promise<void>;
}

export function NewMeetingScreen({ settings, models, onBack, onStart }: NewMeetingScreenProps) {
  const [title, setTitle] = useState('');
  const [runtime, setRuntime] = useState<RuntimeKind>(settings.defaultRuntime);
  const [sourceLanguage, setSourceLanguage] = useState(settings.defaultLanguage);
  const [translationMode, setTranslationMode] = useState<TranslationMode>(settings.defaultTranslationMode);
  const [keywords, setKeywords] = useState('security, decision, action item');
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();

  const speech = models.find((model) => model.id === settings.activeSpeechModelId);
  const vad = models.find((model) => model.role === 'vad');
  const nativeReady = Boolean(speech?.installed && vad?.installed);
  const canStart = consentAcknowledged && (runtime === 'demo' || nativeReady) && !starting;
  const keywordList = useMemo(() => keywords.split(',').map((term) => term.trim()).filter(Boolean), [keywords]);

  const start = async () => {
    if (!canStart) return;
    setStarting(true);
    setError(undefined);
    try {
      await onStart({
        title,
        runtime,
        sourceLanguage: sourceLanguage.trim() || 'auto',
        translationMode,
        keywords: keywordList,
        consentAcknowledged
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start the meeting.');
      setStarting(false);
    }
  };

  return (
    <View style={styles.root}>
      <TopBar title="New meeting" onBack={onBack} />
      <ScrollScreen>
        <View style={styles.intro}>
          <Text style={styles.title}>Prepare the room.</Text>
          <Text style={styles.detail}>Choose how Roomtone should listen, what to highlight, and confirm that everyone has been told recording is active.</Text>
        </View>

        <Field label="Meeting title">
          <TextInput value={title} onChangeText={setTitle} placeholder="Architecture review" placeholderTextColor={palette.inkFaint} style={styles.input} returnKeyType="done" />
        </Field>

        <Field label="Capture mode" detail="Guided demo works in Expo Go. On-device audio requires a native build and downloaded models.">
          <SegmentedControl value={runtime} options={[{ value: 'demo', label: 'Guided demo' }, { value: 'native', label: 'On-device audio' }]} onChange={setRuntime} />
          {runtime === 'native' ? (
            <View style={styles.readiness}>
              <ReadinessRow label="Speech model" ready={Boolean(speech?.installed)} detail={speech?.title ?? 'No active speech model'} />
              <ReadinessRow label="Voice activity model" ready={Boolean(vad?.installed)} detail={vad?.title ?? 'No VAD model'} />
              {!nativeReady ? <Text style={styles.readinessHint}>Install the required local models from Settings before starting.</Text> : null}
            </View>
          ) : null}
        </Field>

        <Field label="Spoken language" detail="Use auto for multilingual meetings or enter a Whisper language code such as en, es, fr, or de.">
          <TextInput value={sourceLanguage} onChangeText={setSourceLanguage} placeholder="auto" placeholderTextColor={palette.inkFaint} autoCapitalize="none" autoCorrect={false} style={styles.input} />
        </Field>

        <Field label="Translation">
          <SegmentedControl value={translationMode} options={[{ value: 'off', label: 'Keep original only' }, { value: 'english', label: 'Add English' }]} onChange={setTranslationMode} />
        </Field>

        <Field label="Live keywords" detail="Comma-separated terms are highlighted deterministically in the transcript.">
          <TextInput value={keywords} onChangeText={setKeywords} placeholder="security, budget, deadline" placeholderTextColor={palette.inkFaint} style={[styles.input, styles.multiline]} multiline />
          <Text style={styles.keywordCount}>{keywordList.length} configured term{keywordList.length === 1 ? '' : 's'}</Text>
        </Field>

        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consentAcknowledged }} onPress={() => setConsentAcknowledged((value) => !value)} style={styles.consent}>
          <View style={[styles.checkbox, consentAcknowledged && styles.checkboxChecked]}>{consentAcknowledged ? <Text style={styles.check}>✓</Text> : null}</View>
          <View style={styles.consentCopy}>
            <Text style={styles.consentTitle}>Everyone has been notified</Text>
            <Text style={styles.consentText}>I have told participants that Roomtone will record and analyze this meeting. I understand that recording laws and organizational policies still apply.</Text>
          </View>
        </Pressable>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Button label={starting ? 'Starting meeting' : 'Start meeting'} loading={starting} disabled={!canStart} fullWidth onPress={() => void start()} />
      </ScrollScreen>
    </View>
  );
}

function Field({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>{detail ? <Text style={styles.fieldDetail}>{detail}</Text> : null}{children}</View>;
}

function ReadinessRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return <View style={styles.readinessRow}><Text style={styles.readinessState}>{ready ? 'Ready' : 'Needed'}</Text><View style={styles.readinessCopy}><Text style={styles.readinessLabel}>{label}</Text><Text style={styles.readinessDetail}>{detail}</Text></View></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  intro: { gap: spacing.sm, marginBottom: spacing.xl },
  title: { ...typography.heading, color: palette.ink },
  detail: { ...typography.body, color: palette.inkSubtle },
  field: { gap: spacing.sm, marginBottom: spacing.xl },
  label: { ...typography.subheading, color: palette.ink },
  fieldDetail: { ...typography.meta, color: palette.inkSubtle },
  input: { minHeight: 52, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface, paddingHorizontal: spacing.md, ...typography.body, color: palette.ink },
  multiline: { minHeight: 86, paddingTop: spacing.md, textAlignVertical: 'top' },
  keywordCount: { ...typography.meta, color: palette.inkSubtle },
  readiness: { borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface, overflow: 'hidden' },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  readinessState: { ...typography.meta, color: palette.ink, width: 52 },
  readinessCopy: { flex: 1, gap: spacing.xxs },
  readinessLabel: { ...typography.bodyStrong, color: palette.ink },
  readinessDetail: { ...typography.meta, color: palette.inkSubtle },
  readinessHint: { ...typography.meta, color: palette.inkSubtle, padding: spacing.md },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.lg, backgroundColor: palette.surface },
  checkbox: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: palette.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: palette.dark, borderColor: palette.dark },
  check: { color: palette.onDark, fontSize: 17, fontWeight: '700' },
  consentCopy: { flex: 1, gap: spacing.xs },
  consentTitle: { ...typography.bodyStrong, color: palette.ink },
  consentText: { ...typography.meta, color: palette.inkSubtle },
  error: { ...typography.body, color: palette.destructive, marginBottom: spacing.md }
});
