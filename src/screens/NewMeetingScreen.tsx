import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import { SegmentedControl } from '../components/SegmentedControl.tsx';
import { TopBar } from '../components/TopBar.tsx';
import type { AppSettings, CalendarEventContext, MeetingDraft, ModelState, RuntimeKind, SessionKind, TranslationMode } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

interface NewMeetingScreenProps {
  settings: AppSettings;
  models: ModelState[];
  mode?: 'meeting' | 'voice_note';
  calendarEvent?: CalendarEventContext;
  onBack(): void;
  onStart(draft: MeetingDraft): Promise<void>;
}

function initialTitle(mode: 'meeting' | 'voice_note', event?: CalendarEventContext): string {
  if (event) return event.title;
  if (mode === 'voice_note') return `Voice note · ${new Date().toLocaleDateString()}`;
  return '';
}

export function NewMeetingScreen({ settings, models, mode = 'meeting', calendarEvent, onBack, onStart }: NewMeetingScreenProps) {
  const [title, setTitle] = useState(initialTitle(mode, calendarEvent));
  const [runtime, setRuntime] = useState<RuntimeKind>(mode === 'voice_note' ? 'native' : settings.defaultRuntime);
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
  const kind: SessionKind = mode === 'voice_note' ? 'voice_note' : 'meeting';

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
        consentAcknowledged,
        kind,
        calendarEvent,
        tags: calendarEvent ? ['calendar'] : []
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start the session.');
      setStarting(false);
    }
  };

  const noun = mode === 'voice_note' ? 'voice note' : 'meeting';
  return (
    <View style={styles.root}>
      <TopBar title={`New ${noun}`} onBack={onBack} />
      <ScrollScreen>
        <View style={styles.intro}>
          <Text style={styles.title}>{mode === 'voice_note' ? 'Capture the thought.' : 'Prepare the room.'}</Text>
          <Text style={styles.detail}>{mode === 'voice_note' ? 'Record an offline thought, interview, field note, or conversation and turn it into the same reusable intelligence workspace.' : 'Choose how Roomtone should listen, what to highlight, and confirm that everyone has been told recording is active.'}</Text>
        </View>

        {calendarEvent ? (
          <View style={styles.calendarContext}>
            <Text style={styles.calendarEyebrow}>Calendar context</Text>
            <Text style={styles.calendarTitle}>{calendarEvent.title}</Text>
            <Text style={styles.calendarMeta}>{new Date(calendarEvent.startAt).toLocaleString()} · {calendarEvent.attendees.length} expected participant{calendarEvent.attendees.length === 1 ? '' : 's'}</Text>
            {calendarEvent.attendees.length ? <Text style={styles.calendarAttendees}>{calendarEvent.attendees.join(', ')}</Text> : null}
          </View>
        ) : null}

        <Field label="Session title">
          <TextInput value={title} onChangeText={setTitle} placeholder={mode === 'voice_note' ? 'Idea, interview, field note' : 'Architecture review'} placeholderTextColor={palette.inkFaint} style={styles.input} returnKeyType="done" />
        </Field>

        <Field label="Capture mode" detail="Guided demo works without local models. On-device audio uses the phone microphone and downloaded models.">
          <SegmentedControl<RuntimeKind> value={runtime} options={[{ value: 'demo', label: 'Guided demo' }, { value: 'native', label: 'On-device audio' }]} onChange={setRuntime} />
          {runtime === 'native' ? (
            <View style={styles.readiness}>
              <ReadinessRow label="Speech model" ready={Boolean(speech?.installed)} detail={speech?.title ?? 'No active speech model'} />
              <ReadinessRow label="Voice activity model" ready={Boolean(vad?.installed)} detail={vad?.title ?? 'No VAD model'} />
              {!nativeReady ? <Text style={styles.readinessHint}>Install the required local models from Settings before starting.</Text> : null}
            </View>
          ) : null}
        </Field>

        <Field label="Spoken language" detail="Use auto for multilingual sessions or enter a Whisper language code such as en, es, fr, or de.">
          <TextInput value={sourceLanguage} onChangeText={setSourceLanguage} placeholder="auto" placeholderTextColor={palette.inkFaint} autoCapitalize="none" autoCorrect={false} style={styles.input} />
        </Field>

        <Field label="Translation">
          <SegmentedControl<TranslationMode> value={translationMode} options={[{ value: 'off', label: 'Keep original only' }, { value: 'english', label: 'Add English' }]} onChange={setTranslationMode} />
        </Field>

        <Field label="Live keywords" detail="Comma-separated terms are highlighted deterministically in the transcript.">
          <TextInput value={keywords} onChangeText={setKeywords} placeholder="security, budget, deadline" placeholderTextColor={palette.inkFaint} style={[styles.input, styles.multiline]} multiline />
          <Text style={styles.keywordCount}>{keywordList.length} configured term{keywordList.length === 1 ? '' : 's'}</Text>
        </Field>

        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consentAcknowledged }} onPress={() => setConsentAcknowledged((value) => !value)} style={styles.consent}>
          <View style={[styles.checkbox, consentAcknowledged && styles.checkboxChecked]}>{consentAcknowledged ? <Text style={styles.check}>✓</Text> : null}</View>
          <View style={styles.consentCopy}>
            <Text style={styles.consentTitle}>{mode === 'voice_note' ? 'Recording is appropriate and visible' : 'Everyone has been notified'}</Text>
            <Text style={styles.consentText}>{mode === 'voice_note' ? 'I understand that Roomtone records the microphone and that I am responsible for consent, privacy, and organizational policy.' : 'I have told participants that Roomtone will record and analyze this meeting. Recording laws and organizational policies still apply.'}</Text>
          </View>
        </Pressable>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Button label={starting ? `Starting ${noun}` : `Start ${noun}`} loading={starting} disabled={!canStart} fullWidth onPress={() => void start()} />
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
  calendarContext: { gap: spacing.xs, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface },
  calendarEyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  calendarTitle: { ...typography.subheading, color: palette.ink },
  calendarMeta: { ...typography.meta, color: palette.inkSubtle },
  calendarAttendees: { ...typography.body, color: palette.ink },
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
