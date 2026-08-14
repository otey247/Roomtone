import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import { SectionHeader } from '../components/SectionHeader.tsx';
import { SegmentedControl } from '../components/SegmentedControl.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { TranscriptRow } from '../components/TranscriptRow.tsx';
import type { ExportTemplate, Insight, InsightKind, Meeting, Speaker } from '../domain/types.ts';
import { copyMeeting, copySegment } from '../infrastructure/clipboard.ts';
import { exportMeetingPdf } from '../infrastructure/pdf.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';
import { formatDuration, formatMeetingDate, formatTimestamp } from '../utils/time.ts';

type DetailTab = 'summary' | 'transcript';

interface MeetingDetailScreenProps {
  meeting?: Meeting;
  onBack(): void;
  onRenameSpeaker(speakerId: string, displayName: string): Promise<void>;
  onDelete(): Promise<void>;
}

const outcomeOrder: Array<{ kind: InsightKind; title: string }> = [
  { kind: 'decision', title: 'Decisions' },
  { kind: 'action', title: 'Action items' },
  { kind: 'question', title: 'Open questions' },
  { kind: 'risk', title: 'Risks and dependencies' },
  { kind: 'commitment', title: 'Commitments' }
];

export function MeetingDetailScreen({ meeting, onBack, onRenameSpeaker, onDelete }: MeetingDetailScreenProps) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const [busyExport, setBusyExport] = useState<ExportTemplate>();
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>(() => Object.fromEntries(meeting?.speakers.map((speaker) => [speaker.id, speaker.displayName]) ?? []));

  const outcomes = useMemo(() => outcomeOrder.map((group) => ({
    ...group,
    items: meeting?.insights.filter((insight) => insight.kind === group.kind) ?? []
  })).filter((group) => group.items.length), [meeting?.insights]);

  if (!meeting) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Meeting not found</Text>
        <Button label="Return to library" onPress={onBack} />
      </View>
    );
  }

  const exportPdf = async (template: ExportTemplate) => {
    setBusyExport(template);
    try {
      await exportMeetingPdf(meeting, template);
    } catch (cause) {
      Alert.alert('Could not export PDF', cause instanceof Error ? cause.message : 'The meeting could not be exported.');
    } finally {
      setBusyExport(undefined);
    }
  };

  const copy = async () => {
    try {
      await copyMeeting(meeting);
      Alert.alert('Copied', 'The meeting brief is ready to paste.');
    } catch (cause) {
      Alert.alert('Could not copy', cause instanceof Error ? cause.message : 'The meeting could not be copied.');
    }
  };

  const confirmDelete = () => Alert.alert(
    'Delete this meeting?',
    'The transcript, outcomes, event history, and local audio file will be removed from this device.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void onDelete() }
    ]
  );

  return (
    <View style={styles.root}>
      <TopBar title={meeting.title} subtitle={formatMeetingDate(meeting.startedAt)} onBack={onBack} actionLabel="Copy" onAction={() => void copy()} />
      <View style={styles.tabWrap}>
        <SegmentedControl<DetailTab> value={tab} options={[{ value: 'summary', label: 'Summary' }, { value: 'transcript', label: `Transcript · ${meeting.segments.length}` }]} onChange={setTab} />
      </View>

      {tab === 'transcript' ? (
        <ScrollScreen contentContainerStyle={styles.transcriptContent}>
          {meeting.segments.filter((segment) => segment.isFinal).map((segment) => (
            <TranscriptRow
              key={segment.id}
              segment={segment}
              speakerName={meeting.speakers.find((speaker) => speaker.id === segment.speakerId)?.displayName ?? 'Unknown speaker'}
              keywords={meeting.keywordDefinitions}
              onLongPress={() => void copySegment(meeting, segment)}
            />
          ))}
          {!meeting.segments.length ? <Text style={styles.muted}>No final transcript segments were captured.</Text> : null}
        </ScrollScreen>
      ) : (
        <ScrollScreen>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>{formatDuration(meeting.metrics.durationMs)} · {meeting.speakers.length} speaker{meeting.speakers.length === 1 ? '' : 's'}</Text>
            <Text style={styles.summary}>{meeting.summary || 'No summary was generated for this meeting.'}</Text>
            <Text style={styles.verification}>Automated observations are starting points. Verify them against the linked transcript timestamp before reuse.</Text>
          </View>

          <View style={styles.metricGrid}>
            <Metric value={meeting.metrics.decisionCount} label="Decisions" />
            <Metric value={meeting.metrics.actionCount} label="Actions" />
            <Metric value={meeting.metrics.questionCount} label="Questions" />
            <Metric value={meeting.metrics.totalTurns} label="Turns" />
          </View>

          <View style={styles.section}>
            <SectionHeader title="Outcome completeness" detail="Meeting-level workflow measures, not employee scoring" />
            <View style={styles.completeness}>
              <CompletenessRow label="Actions with owner" value={meeting.metrics.actionsWithOwner} total={meeting.metrics.actionCount} />
              <CompletenessRow label="Actions with due date" value={meeting.metrics.actionsWithDueDate} total={meeting.metrics.actionCount} />
              <View style={styles.completenessRow}><Text style={styles.completenessLabel}>Average turn</Text><Text style={styles.completenessValue}>{formatDuration(meeting.metrics.averageTurnMs)}</Text></View>
              <View style={styles.completenessRow}><Text style={styles.completenessLabel}>Longest turn</Text><Text style={styles.completenessValue}>{formatDuration(meeting.metrics.longestTurnMs)}</Text></View>
            </View>
          </View>

          {outcomes.map((group) => (
            <View key={group.kind} style={styles.section}>
              <SectionHeader title={group.title} detail={`${group.items.length} captured`} />
              <View style={styles.outcomes}>{group.items.map((insight) => <OutcomeRow key={insight.id} insight={insight} />)}</View>
            </View>
          ))}

          <View style={styles.section}>
            <SectionHeader title="Speakers" detail="Anonymous labels can be corrected without changing transcript evidence" />
            <View style={styles.speakers}>
              {meeting.speakers.map((speaker) => (
                <SpeakerEditor
                  key={speaker.id}
                  speaker={speaker}
                  value={speakerNames[speaker.id] ?? speaker.displayName}
                  onChange={(value) => setSpeakerNames((current) => ({ ...current, [speaker.id]: value }))}
                  onSave={() => void onRenameSpeaker(speaker.id, speakerNames[speaker.id] ?? speaker.displayName)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Export" detail="Generated on the device" />
            <View style={styles.exportGrid}>
              {([
                ['brief', 'Meeting brief'],
                ['minutes', 'Meeting minutes'],
                ['actions', 'Action register'],
                ['transcript', 'Full transcript']
              ] as Array<[ExportTemplate, string]>).map(([template, label]) => (
                <Button key={template} label={label} variant="secondary" loading={busyExport === template} disabled={Boolean(busyExport)} style={styles.exportButton} onPress={() => void exportPdf(template)} />
              ))}
            </View>
          </View>

          <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete meeting from this device</Text></Pressable>
        </ScrollScreen>
      )}
    </View>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function CompletenessRow({ label, value, total }: { label: string; value: number; total: number }) {
  const detail = total ? `${value} of ${total} · ${Math.round(value / total * 100)}%` : 'No actions';
  return <View style={styles.completenessRow}><Text style={styles.completenessLabel}>{label}</Text><Text style={styles.completenessValue}>{detail}</Text></View>;
}

function OutcomeRow({ insight }: { insight: Insight }) {
  return (
    <View style={styles.outcome}>
      <View style={styles.outcomeHead}><Text style={styles.outcomeTime}>{formatTimestamp(insight.evidenceStartMs)}</Text><Text style={styles.outcomeConfidence}>{Math.round(insight.confidence * 100)}% confidence</Text></View>
      <Text style={styles.outcomeText}>{insight.text}</Text>
      {insight.kind === 'action' ? <Text style={styles.outcomeMeta}>Owner: {insight.owner ?? 'Unassigned'} · Due: {insight.dueText ?? 'Not captured'}</Text> : null}
    </View>
  );
}

function SpeakerEditor({ speaker, value, onChange, onSave }: { speaker: Speaker; value: string; onChange(value: string): void; onSave(): void }) {
  const changed = value.trim() && value.trim() !== speaker.displayName;
  return (
    <View style={styles.speakerRow}>
      <TextInput accessibilityLabel={`Name for ${speaker.displayName}`} value={value} onChangeText={onChange} style={styles.speakerInput} />
      <Button label="Save" variant="secondary" disabled={!changed} onPress={onSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl, backgroundColor: palette.canvas },
  notFoundTitle: { ...typography.heading, color: palette.ink },
  tabWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  transcriptContent: { paddingHorizontal: 0, paddingTop: 0 },
  hero: { gap: spacing.sm, marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  summary: { ...typography.heading, color: palette.ink },
  verification: { ...typography.meta, color: palette.inkSubtle },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  metric: { width: '47%', flexGrow: 1, minHeight: 94, padding: spacing.md, justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  metricValue: { ...typography.heading, color: palette.ink },
  metricLabel: { ...typography.meta, color: palette.inkSubtle },
  section: { gap: spacing.md, marginBottom: spacing.xl },
  completeness: { borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface, overflow: 'hidden' },
  completenessRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  completenessLabel: { ...typography.body, color: palette.ink },
  completenessValue: { ...typography.meta, color: palette.inkSubtle, textAlign: 'right' },
  outcomes: { gap: spacing.sm },
  outcome: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  outcomeHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  outcomeTime: { ...typography.mono, color: palette.inkSubtle },
  outcomeConfidence: { ...typography.meta, color: palette.inkFaint },
  outcomeText: { ...typography.bodyStrong, color: palette.ink },
  outcomeMeta: { ...typography.meta, color: palette.inkSubtle },
  speakers: { gap: spacing.sm },
  speakerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  speakerInput: { flex: 1, minHeight: 48, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface, ...typography.body, color: palette.ink },
  exportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exportButton: { width: '47%', flexGrow: 1 },
  deleteButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  deleteText: { ...typography.bodyStrong, color: palette.destructive },
  muted: { ...typography.body, color: palette.inkSubtle, textAlign: 'center', padding: spacing.xl }
});
