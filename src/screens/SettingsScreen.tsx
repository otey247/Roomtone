import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import { SectionHeader } from '../components/SectionHeader.tsx';
import { SegmentedControl } from '../components/SegmentedControl.tsx';
import type { AppSettings, ModelState, RuntimeKind } from '../domain/types.ts';
import { copyText } from '../infrastructure/clipboard.ts';
import {
  collectDeviceDiagnostics,
  formatDeviceDiagnosticReport,
  type DeviceDiagnosticSnapshot
} from '../infrastructure/device-diagnostics.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

interface SettingsScreenProps {
  settings: AppSettings;
  models: ModelState[];
  onUpdateSettings(patch: Partial<AppSettings>): Promise<void>;
  onInstallModel(id: string): Promise<void>;
  onRemoveModel(id: string): Promise<void>;
  onLoadSamples(): Promise<void>;
}

export function SettingsScreen({ settings, models, onUpdateSettings, onInstallModel, onRemoveModel, onLoadSamples }: SettingsScreenProps) {
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [operationError, setOperationError] = useState<string>();
  const [diagnostics, setDiagnostics] = useState<DeviceDiagnosticSnapshot>();
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const speechModels = models.filter((model) => model.role === 'speech');
  const vadModels = models.filter((model) => model.role === 'vad');
  const modelSignature = useMemo(
    () => models.map((model) => `${model.id}:${model.installed}:${model.localUri ?? ''}`).join('|'),
    [models]
  );

  const run = async (operation: () => Promise<void>) => {
    setOperationError(undefined);
    try { await operation(); }
    catch (cause) { setOperationError(cause instanceof Error ? cause.message : 'The operation could not be completed.'); }
  };

  const refreshDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      setDiagnostics(await collectDeviceDiagnostics(settings, models));
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : 'Device diagnostics could not be collected.');
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  useEffect(() => {
    void refreshDiagnostics();
  }, [modelSignature, settings.activeSpeechModelId]);

  const loadSamples = async () => {
    setLoadingSamples(true);
    await run(onLoadSamples);
    setLoadingSamples(false);
  };

  const copyDiagnostics = async () => {
    if (!diagnostics) return;
    await run(() => copyText(formatDeviceDiagnosticReport(diagnostics)));
  };

  return (
    <ScrollScreen>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Roomtone</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.detail}>Control capture defaults, local AI models, retention, and device behavior.</Text>
      </View>

      {operationError ? <Text accessibilityRole="alert" style={styles.error}>{operationError}</Text> : null}

      <View style={styles.section}>
        <SectionHeader title="Meeting defaults" />
        <SettingBlock label="Capture mode" detail="Guided demo is available in Expo Go. On-device audio requires a native build.">
          <SegmentedControl<RuntimeKind> value={settings.defaultRuntime} options={[{ value: 'demo', label: 'Guided demo' }, { value: 'native', label: 'On-device audio' }]} onChange={(defaultRuntime) => void run(() => onUpdateSettings({ defaultRuntime }))} />
        </SettingBlock>
        <ToggleRow label="Keep screen awake while recording" detail="Prevents the display from sleeping during an active meeting." value={settings.keepScreenAwake} onChange={(keepScreenAwake) => void run(() => onUpdateSettings({ keepScreenAwake }))} />
        <ToggleRow label="Participant notification reminder" detail="Requires confirmation before every recording session." value={settings.consentReminderEnabled} onChange={(consentReminderEnabled) => void run(() => onUpdateSettings({ consentReminderEnabled }))} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Local speech models" detail="Downloads are explicit and stored in the application sandbox" />
        <View style={styles.modelList}>
          {speechModels.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              active={settings.activeSpeechModelId === model.id}
              onSelect={() => void run(() => onUpdateSettings({ activeSpeechModelId: model.id }))}
              onInstall={() => void run(() => onInstallModel(model.id))}
              onRemove={() => void run(() => onRemoveModel(model.id))}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Voice activity detection" detail="Required by the native runtime" />
        <View style={styles.modelList}>
          {vadModels.map((model) => (
            <ModelRow key={model.id} model={model} active={false} onInstall={() => void run(() => onInstallModel(model.id))} onRemove={() => void run(() => onRemoveModel(model.id))} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="APK and device diagnostics" detail="Confirms the installed binary and native runtime on this phone" />
        {diagnostics ? (
          <>
            <View style={styles.diagnosticSummary}>
              <Text style={styles.diagnosticTitle}>{diagnostics.application.name}</Text>
              <Text style={styles.diagnosticMeta}>
                {diagnostics.application.version} ({diagnostics.application.buildVersion}) · {diagnostics.application.applicationId}
              </Text>
              <Text style={styles.diagnosticMeta}>
                {diagnostics.device.manufacturer} {diagnostics.device.modelName} · Android {diagnostics.device.osVersion} · API {diagnostics.device.apiLevel}
              </Text>
              <Text style={styles.diagnosticMeta}>
                Build {diagnostics.application.buildSha.slice(0, 10)} · {diagnostics.application.buildVariant} · {diagnostics.application.architecture}
              </Text>
            </View>
            <View style={styles.diagnosticList}>
              {diagnostics.readiness.checks.map((check) => (
                <DiagnosticRow key={check.id} label={check.label} status={check.status} detail={check.detail} />
              ))}
            </View>
            <Text style={styles.readinessResult}>
              Native meeting runtime: {diagnostics.readiness.nativeMeetingReady ? 'Ready to test' : 'Setup required'}
            </Text>
          </>
        ) : (
          <Text style={styles.settingDetail}>Collecting application and device information.</Text>
        )}
        <View style={styles.diagnosticActions}>
          <Button label="Refresh diagnostics" variant="secondary" loading={diagnosticsLoading} style={styles.diagnosticButton} onPress={() => void refreshDiagnostics()} />
          <Button label="Copy report" variant="secondary" disabled={!diagnostics || diagnosticsLoading} style={styles.diagnosticButton} onPress={() => void copyDiagnostics()} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Local retention" detail="Applied when Roomtone initializes" />
        <SettingBlock label="Delete audio after">
          <SegmentedControl value={String(settings.deleteAudioAfterDays ?? 'never')} options={[{ value: 'never', label: 'Never' }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} onChange={(value) => void run(() => onUpdateSettings({ deleteAudioAfterDays: value === 'never' ? null : Number(value) }))} />
        </SettingBlock>
        <SettingBlock label="Delete meetings after">
          <SegmentedControl value={String(settings.deleteMeetingsAfterDays ?? 'never')} options={[{ value: 'never', label: 'Never' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} onChange={(value) => void run(() => onUpdateSettings({ deleteMeetingsAfterDays: value === 'never' ? null : Number(value) }))} />
        </SettingBlock>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Guided demo data" detail="Adds two completed sample meetings to the local library" />
        <Button label="Load sample meetings" variant="secondary" fullWidth loading={loadingSamples} onPress={() => void loadSamples()} />
      </View>

      <View style={styles.about}>
        <Text style={styles.aboutTitle}>Privacy boundary</Text>
        <Text style={styles.aboutText}>Roomtone does not provide hidden recording, same-phone call interception, employee rankings, or a required cloud account. The person operating the app remains responsible for notification and recording-law compliance.</Text>
      </View>
    </ScrollScreen>
  );
}

function SettingBlock({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return <View style={styles.settingBlock}><Text style={styles.settingLabel}>{label}</Text>{detail ? <Text style={styles.settingDetail}>{detail}</Text> : null}{children}</View>;
}

function ToggleRow({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange(value: boolean): void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}><Text style={styles.settingLabel}>{label}</Text><Text style={styles.settingDetail}>{detail}</Text></View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: palette.lineStrong, true: palette.dark }} thumbColor={palette.surface} />
    </View>
  );
}

function DiagnosticRow({ label, status, detail }: { label: string; status: 'ready' | 'warning' | 'blocked'; detail: string }) {
  const statusLabel = status === 'ready' ? 'Ready' : status === 'warning' ? 'Needs setup' : 'Blocked';
  return (
    <View style={styles.diagnosticRow}>
      <View style={styles.diagnosticCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDetail}>{detail}</Text>
      </View>
      <Text style={styles.diagnosticStatus}>{statusLabel}</Text>
    </View>
  );
}

function ModelRow({ model, active, onSelect, onInstall, onRemove }: { model: ModelState; active: boolean; onSelect?: () => void; onInstall(): void; onRemove(): void }) {
  const size = model.approximateBytes < 1_000_000
    ? `${Math.round(model.approximateBytes / 1_000)} KB`
    : `${Math.round(model.approximateBytes / 1_000_000)} MB`;
  return (
    <View style={styles.modelRow}>
      <Pressable disabled={!model.installed || !onSelect} onPress={onSelect} style={styles.modelCopy}>
        <View style={styles.modelTitleRow}><Text style={styles.modelTitle}>{model.title}</Text>{active ? <Text style={styles.activeText}>Active</Text> : null}</View>
        <Text style={styles.modelDescription}>{model.description}</Text>
        <Text style={styles.modelMeta}>{size} · {model.resourceClass} resource use{model.supportsSpeakerTurns ? ' · anonymous turns' : ''}</Text>
        {model.downloading ? <Text style={styles.downloadText}>Downloading · {Math.round(model.downloadProgress * 100)}%</Text> : null}
        {model.error ? <Text style={styles.modelError}>{model.error}</Text> : null}
      </Pressable>
      <Button label={model.installed ? 'Remove' : 'Install'} variant="secondary" loading={model.downloading} onPress={model.installed ? onRemove : onInstall} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs, marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  title: { ...typography.title, color: palette.ink },
  detail: { ...typography.body, color: palette.inkSubtle },
  error: { ...typography.body, color: palette.destructive, marginBottom: spacing.lg },
  section: { gap: spacing.md, marginBottom: spacing.xxl },
  settingBlock: { gap: spacing.sm },
  settingLabel: { ...typography.bodyStrong, color: palette.ink },
  settingDetail: { ...typography.meta, color: palette.inkSubtle },
  toggleRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  toggleCopy: { flex: 1, gap: spacing.xxs },
  modelList: { gap: spacing.sm },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  modelCopy: { flex: 1, gap: spacing.xs },
  modelTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  modelTitle: { ...typography.bodyStrong, color: palette.ink, flexShrink: 1 },
  activeText: { ...typography.meta, color: palette.primary, fontWeight: '700' },
  modelDescription: { ...typography.meta, color: palette.inkSubtle },
  modelMeta: { ...typography.meta, color: palette.inkFaint },
  downloadText: { ...typography.meta, color: palette.ink },
  modelError: { ...typography.meta, color: palette.destructive },
  diagnosticSummary: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  diagnosticTitle: { ...typography.subheading, color: palette.ink },
  diagnosticMeta: { ...typography.meta, color: palette.inkSubtle },
  diagnosticList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  diagnosticRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  diagnosticCopy: { flex: 1, gap: spacing.xxs },
  diagnosticStatus: { ...typography.meta, color: palette.ink, fontWeight: '700', textAlign: 'right', maxWidth: 84 },
  readinessResult: { ...typography.bodyStrong, color: palette.ink },
  diagnosticActions: { flexDirection: 'row', gap: spacing.sm },
  diagnosticButton: { flex: 1 },
  about: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  aboutTitle: { ...typography.bodyStrong, color: palette.ink },
  aboutText: { ...typography.body, color: palette.inkSubtle }
});
