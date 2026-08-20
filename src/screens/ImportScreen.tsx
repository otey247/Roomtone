import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import { TopBar } from '../components/TopBar.tsx';
import type { Meeting, ModelState } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

interface ImportScreenProps {
  models: ModelState[];
  activeModelId: string;
  onBack(): void;
  onImportLocal(): Promise<Meeting | undefined>;
  onImportRemote(url: string, title?: string): Promise<Meeting>;
  onOpenSession(meetingId: string): void;
}

export function ImportScreen({ models, activeModelId, onBack, onImportLocal, onImportRemote, onOpenSession }: ImportScreenProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<'local' | 'remote'>();
  const [error, setError] = useState<string>();
  const speech = models.find((model) => model.id === activeModelId);
  const ready = Boolean(speech?.installed);

  const importLocal = async () => {
    setBusy('local');
    setError(undefined);
    try {
      const meeting = await onImportLocal();
      if (meeting) onOpenSession(meeting.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The selected media could not be imported.');
    } finally {
      setBusy(undefined);
    }
  };

  const importRemote = async () => {
    if (!url.trim()) return;
    setBusy('remote');
    setError(undefined);
    try {
      const meeting = await onImportRemote(url, title);
      onOpenSession(meeting.id);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The media URL could not be imported.';
      setError(message);
      Alert.alert('Import could not start', message);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <View style={styles.root}>
      <TopBar title="Import media" onBack={onBack} />
      <ScrollScreen>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>One workspace, every source</Text>
          <Text style={styles.title}>Convert existing audio and video into a Roomtone session.</Text>
          <Text style={styles.detail}>The Android Files picker can expose local storage and document providers installed on your phone, including Google Drive, Dropbox, OneDrive, and SharePoint. Roomtone copies the selected media into private app storage, extracts a mono audio track, and transcribes it with the active local model.</Text>
        </View>

        <View style={styles.readiness}>
          <Text style={styles.readinessLabel}>Active speech model</Text>
          <Text style={styles.readinessValue}>{speech?.title ?? 'No active model'}</Text>
          <Text style={styles.readinessState}>{ready ? 'Ready for on-device file transcription' : 'Install this model from Settings before importing media'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose from Files</Text>
          <Text style={styles.sectionText}>Supported source containers depend on Android's installed media decoders. Common WAV, MP3, M4A, AAC, MP4, MOV, WebM, and similar files are normalized before transcription.</Text>
          <Button label="Choose audio or video" fullWidth loading={busy === 'local'} disabled={!ready || Boolean(busy)} onPress={() => void importLocal()} />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Direct media URL</Text>
          <Text style={styles.sectionText}>Use an HTTPS URL that downloads an audio or video file directly. YouTube watch pages are intentionally not treated as downloadable media.</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Optional session title" placeholderTextColor={palette.inkFaint} style={styles.input} />
          <TextInput value={url} onChangeText={setUrl} placeholder="https://example.com/recording.mp4" placeholderTextColor={palette.inkFaint} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[styles.input, styles.urlInput]} multiline />
          <Button label="Import direct URL" variant="secondary" fullWidth loading={busy === 'remote'} disabled={!ready || !url.trim() || Boolean(busy)} onPress={() => void importRemote()} />
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <View style={styles.processingNote}>
          <Text style={styles.processingTitle}>Long files continue processing in the session workspace</Text>
          <Text style={styles.processingText}>Keep the phone charged for extended media. Progress and failures remain visible in the session, and the original source is retained until you delete the session or retention rules remove it.</Text>
        </View>
      </ScrollScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  intro: { gap: spacing.sm, marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  title: { ...typography.heading, color: palette.ink },
  detail: { ...typography.body, color: palette.inkSubtle },
  readiness: { gap: spacing.xs, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface },
  readinessLabel: { ...typography.eyebrow, color: palette.inkSubtle },
  readinessValue: { ...typography.bodyStrong, color: palette.ink },
  readinessState: { ...typography.meta, color: palette.inkSubtle },
  section: { gap: spacing.md, marginBottom: spacing.lg },
  sectionTitle: { ...typography.subheading, color: palette.ink },
  sectionText: { ...typography.body, color: palette.inkSubtle },
  input: { minHeight: 52, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface, ...typography.body, color: palette.ink },
  urlInput: { minHeight: 82, paddingTop: spacing.md, textAlignVertical: 'top' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.line, marginVertical: spacing.lg },
  error: { ...typography.body, color: palette.destructive, marginBottom: spacing.lg },
  processingNote: { gap: spacing.xs, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  processingTitle: { ...typography.bodyStrong, color: palette.ink },
  processingText: { ...typography.body, color: palette.inkSubtle }
});
