import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { MessageBubble } from './AskScreen.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import { SectionHeader } from '../components/SectionHeader.tsx';
import { SessionPlayer } from '../components/SessionPlayer.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { TranscriptRow } from '../components/TranscriptRow.tsx';
import { WorkspaceTabs, type WorkspaceTab } from '../components/WorkspaceTabs.tsx';
import type {
  ChatMessage,
  ExportTemplate,
  Insight,
  InsightKind,
  Meeting,
  SessionNote,
  Speaker,
  SummaryItem,
  TranscriptCitation
} from '../domain/types.ts';
import { copyMeeting, copySegment } from '../infrastructure/clipboard.ts';
import { exportMeetingPdf } from '../infrastructure/pdf.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';
import { formatDuration, formatMeetingDate, formatTimestamp } from '../utils/time.ts';

interface MeetingDetailScreenProps {
  meeting?: Meeting;
  initialTab?: WorkspaceTab;
  initialSeekMs?: number;
  onBack(): void;
  onRenameSpeaker(speakerId: string, displayName: string): Promise<void>;
  onDelete(): Promise<void>;
  onAddNote(text: string, linkedStartMs?: number): Promise<void>;
  onUpdateNote(noteId: string, text: string): Promise<void>;
  onDeleteNote(noteId: string): Promise<void>;
  onAsk(question: string): Promise<ChatMessage[]>;
  onUpdateInsight(insightId: string, patch: Partial<Pick<Insight, 'owner' | 'dueText' | 'resolved' | 'text'>>): Promise<void>;
}

const insightGroups: Array<{ kind: InsightKind; title: string }> = [
  { kind: 'decision', title: 'Decisions' },
  { kind: 'question', title: 'Open questions' },
  { kind: 'risk', title: 'Risks and blockers' },
  { kind: 'commitment', title: 'Commitments' }
];

export function MeetingDetailScreen({
  meeting,
  initialTab = 'summary',
  initialSeekMs,
  onBack,
  onRenameSpeaker,
  onDelete,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onAsk,
  onUpdateInsight
}: MeetingDetailScreenProps) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [seekMs, setSeekMs] = useState<number | undefined>(initialSeekMs);
  const [positionMs, setPositionMs] = useState(initialSeekMs ?? 0);
  const [busyExport, setBusyExport] = useState<ExportTemplate>();
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(meeting?.speakers.map((speaker) => [speaker.id, speaker.displayName]) ?? [])
  );

  useEffect(() => {
    if (initialTab) setTab(initialTab);
    if (initialSeekMs !== undefined) {
      setSeekMs(initialSeekMs);
      setPositionMs(initialSeekMs);
    }
  }, [initialSeekMs, initialTab]);

  useEffect(() => {
    if (!meeting) return;
    setSpeakerNames((current) => ({
      ...Object.fromEntries(meeting.speakers.map((speaker) => [speaker.id, speaker.displayName])),
      ...current
    }));
  }, [meeting]);

  const finalSegments = useMemo(
    () => meeting?.segments.filter((segment) => segment.isFinal).sort((a, b) => a.startMs - b.startMs) ?? [],
    [meeting?.segments]
  );
  const activeSegmentId = useMemo(() => {
    const direct = finalSegments.find((segment) => positionMs >= segment.startMs && positionMs <= segment.endMs);
    if (direct) return direct.id;
    let nearest = finalSegments[0];
    for (const segment of finalSegments) {
      if (segment.startMs <= positionMs) nearest = segment;
      else break;
    }
    return nearest?.id;
  }, [finalSegments, positionMs]);

  if (!meeting) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Session not found</Text>
        <Button label="Return to sessions" onPress={onBack} />
      </View>
    );
  }

  const audioUri = meeting.audioUri ?? meeting.source?.normalizedAudioUri ?? meeting.source?.uri;
  const openEvidence = (startMs: number) => {
    setSeekMs(startMs);
    setPositionMs(startMs);
    setTab('transcript');
  };

  const copy = async () => {
    try {
      await copyMeeting(meeting);
      Alert.alert('Copied', 'The session brief is ready to paste.');
    } catch (cause) {
      Alert.alert('Could not copy', cause instanceof Error ? cause.message : 'The session could not be copied.');
    }
  };

  const exportPdf = async (template: ExportTemplate) => {
    setBusyExport(template);
    try {
      await exportMeetingPdf(meeting, template);
    } catch (cause) {
      Alert.alert('Could not export PDF', cause instanceof Error ? cause.message : 'The session could not be exported.');
    } finally {
      setBusyExport(undefined);
    }
  };

  const confirmDelete = () => Alert.alert(
    'Delete this session?',
    'The transcript, notes, outcomes, event history, imported source, normalized audio, and local recording will be removed from this device.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void onDelete() }
    ]
  );

  const sourceStatus = meeting.source?.processingStatus;
  const processing = meeting.status === 'processing' || (sourceStatus && !['ready', 'complete', 'failed'].includes(sourceStatus));

  return (
    <View style={styles.root}>
      <TopBar title={meeting.title} subtitle={formatMeetingDate(meeting.startedAt)} onBack={onBack} actionLabel="Copy" onAction={() => void copy()} />
      <WorkspaceTabs value={tab} onChange={setTab} />

      {processing || sourceStatus === 'failed' ? (
        <ProcessingBanner meeting={meeting} />
      ) : null}

      {tab === 'transcript' ? (
        <TranscriptWorkspace
          meeting={meeting}
          audioUri={audioUri}
          seekMs={seekMs}
          activeSegmentId={activeSegmentId}
          onPositionMs={setPositionMs}
          onSeek={openEvidence}
        />
      ) : tab === 'summary' ? (
        <SummaryWorkspace meeting={meeting} onOpenEvidence={openEvidence} />
      ) : tab === 'ask' ? (
        <SessionAskWorkspace meeting={meeting} onAsk={onAsk} onOpenCitation={(citation) => openEvidence(citation.startMs)} />
      ) : tab === 'notes' ? (
        <NotesWorkspace meeting={meeting} currentPositionMs={positionMs} onAdd={onAddNote} onUpdate={onUpdateNote} onDelete={onDeleteNote} onSeek={openEvidence} />
      ) : tab === 'actions' ? (
        <ActionsWorkspace meeting={meeting} onUpdate={onUpdateInsight} onSeek={openEvidence} />
      ) : (
        <InsightsWorkspace
          meeting={meeting}
          speakerNames={speakerNames}
          setSpeakerNames={setSpeakerNames}
          onRenameSpeaker={onRenameSpeaker}
          onSeek={openEvidence}
          busyExport={busyExport}
          onExport={exportPdf}
          onDelete={confirmDelete}
        />
      )}
    </View>
  );
}

function ProcessingBanner({ meeting }: { meeting: Meeting }) {
  const source = meeting.source;
  const progress = Math.round((source?.progress ?? 0) * 100);
  const failed = source?.processingStatus === 'failed' || meeting.status === 'failed';
  return (
    <View style={styles.processingBanner}>
      <View style={styles.processingCopy}>
        <Text style={styles.processingTitle}>{failed ? 'Session processing stopped' : `Processing ${source?.displayName ?? 'session'}`}</Text>
        <Text style={[styles.processingDetail, failed && styles.processingError]}>
          {failed ? source?.error ?? 'The media could not be processed.' : `${source?.processingStatus ?? 'processing'} · ${progress}%`}
        </Text>
      </View>
      {!failed ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(3, progress)}%` }]} /></View> : null}
    </View>
  );
}

function TranscriptWorkspace({ meeting, audioUri, seekMs, activeSegmentId, onPositionMs, onSeek }: {
  meeting: Meeting;
  audioUri?: string;
  seekMs?: number;
  activeSegmentId?: string;
  onPositionMs(positionMs: number): void;
  onSeek(startMs: number): void;
}) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase();
  const segments = meeting.segments.filter((segment) => segment.isFinal && (
    !normalized
    || segment.originalText.toLocaleLowerCase().includes(normalized)
    || segment.translatedText?.toLocaleLowerCase().includes(normalized)
    || meeting.speakers.find((speaker) => speaker.id === segment.speakerId)?.displayName.toLocaleLowerCase().includes(normalized)
  ));

  return (
    <View style={styles.workspaceRoot}>
      <SessionPlayer uri={audioUri} title={meeting.source?.displayName ?? meeting.title} seekMs={seekMs} onPositionMs={onPositionMs} />
      <View style={styles.searchWrap}>
        <TextInput
          accessibilityLabel="Search this transcript"
          value={query}
          onChangeText={setQuery}
          placeholder="Search this transcript"
          placeholderTextColor={palette.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        <Text style={styles.searchMeta}>{segments.length} of {meeting.segments.filter((segment) => segment.isFinal).length} transcript turn{segments.length === 1 ? '' : 's'}</Text>
      </View>
      <ScrollScreen contentContainerStyle={styles.transcriptContent}>
        {segments.map((segment) => (
          <TranscriptRow
            key={segment.id}
            segment={segment}
            speakerName={meeting.speakers.find((speaker) => speaker.id === segment.speakerId)?.displayName ?? 'Unknown speaker'}
            keywords={meeting.keywordDefinitions}
            selected={segment.id === activeSegmentId}
            onPress={() => onSeek(segment.startMs)}
            onLongPress={() => void copySegment(meeting, segment)}
          />
        ))}
        {!segments.length ? <Text style={styles.muted}>{meeting.status === 'processing' ? 'Transcript segments will appear as the imported media is processed.' : 'No matching final transcript segments were found.'}</Text> : null}
      </ScrollScreen>
    </View>
  );
}

function SummaryWorkspace({ meeting, onOpenEvidence }: { meeting: Meeting; onOpenEvidence(startMs: number): void }) {
  const summary = meeting.structuredSummary;
  return (
    <ScrollScreen>
      <View style={styles.summaryHero}>
        <Text style={styles.eyebrow}>{summary?.profile.replace('_', ' ') ?? meeting.kind ?? 'meeting'} summary</Text>
        <Text style={styles.summaryText}>{summary?.executiveSummary || meeting.summary || 'A summary will appear after transcript evidence is available.'}</Text>
        <Text style={styles.verification}>Automated observations are starting points. Open the linked evidence before reusing an answer, action, or decision.</Text>
      </View>

      <SummarySection title="Topics discussed" items={summary?.topics ?? []} onOpenEvidence={onOpenEvidence} empty="No recurring topics were detected." />
      <SummarySection title="Key moments" items={summary?.keyMoments ?? []} onOpenEvidence={onOpenEvidence} empty="No key moments were captured." />
      <SummarySection title="Decisions" items={summary?.decisions ?? []} onOpenEvidence={onOpenEvidence} empty="No explicit decisions were captured." />
      <SummarySection title="Action items" items={summary?.actionItems ?? []} onOpenEvidence={onOpenEvidence} empty="No explicit action items were captured." />
      <SummarySection title="Open questions" items={summary?.openQuestions ?? []} onOpenEvidence={onOpenEvidence} empty="No unresolved questions were captured." />
      <SummarySection title="Risks and blockers" items={summary?.risks ?? []} onOpenEvidence={onOpenEvidence} empty="No explicit risks or blockers were captured." />
      <SummarySection title="Follow-ups" items={summary?.followUps ?? []} onOpenEvidence={onOpenEvidence} empty="No follow-ups were captured." />
      <SummarySection title="Notable statements" items={summary?.notableQuotes ?? []} onOpenEvidence={onOpenEvidence} empty="No notable statements were selected." />
    </ScrollScreen>
  );
}

function SummarySection({ title, items, onOpenEvidence, empty }: { title: string; items: SummaryItem[]; onOpenEvidence(startMs: number): void; empty: string }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} detail={`${items.length} captured`} />
      {items.length ? <View style={styles.itemList}>{items.map((item) => <SummaryRow key={item.id} item={item} onOpenEvidence={onOpenEvidence} />)}</View> : <Text style={styles.emptyLine}>{empty}</Text>}
    </View>
  );
}

function SummaryRow({ item, onOpenEvidence }: { item: SummaryItem; onOpenEvidence(startMs: number): void }) {
  const first = item.evidence[0];
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryRowText}>{item.text}</Text>
      {item.label ? <Text style={styles.summaryRowMeta}>{item.label}</Text> : null}
      {first ? (
        <Pressable onPress={() => onOpenEvidence(first.startMs)} style={styles.evidenceButton}>
          <Text style={styles.evidenceButtonText}>Open evidence · {formatTimestamp(first.startMs)}</Text>
        </Pressable>
      ) : <Text style={styles.noEvidence}>No linked transcript evidence</Text>}
    </View>
  );
}

function SessionAskWorkspace({ meeting, onAsk, onOpenCitation }: {
  meeting: Meeting;
  onAsk(question: string): Promise<ChatMessage[]>;
  onOpenCitation(citation: TranscriptCitation): void;
}) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(meeting.chat ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if ((meeting.chat?.length ?? 0) >= messages.length) setMessages(meeting.chat ?? []);
  }, [meeting.chat, messages.length]);

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
      setError(cause instanceof Error ? cause.message : 'Roomtone could not answer from this transcript.');
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    'What decisions were made?',
    'What action items are still open?',
    'What objections or risks were raised?',
    'Create a follow-up email from the commitments.'
  ];

  return (
    <View style={styles.workspaceRoot}>
      <ScrollScreen>
        <View style={styles.askIntro}>
          <Text style={styles.eyebrow}>Grounded in this session</Text>
          <Text style={styles.askTitle}>Ask any detail</Text>
          <Text style={styles.askDetail}>Roomtone searches the local transcript and captured outcomes. Answers link back to timestamped evidence and say when the recording does not support a response.</Text>
        </View>
        {!messages.length ? <View style={styles.suggestions}>{suggestions.map((suggestion) => <Pressable key={suggestion} onPress={() => void submit(suggestion)} style={styles.suggestion}><Text style={styles.suggestionText}>{suggestion}</Text></Pressable>)}</View> : null}
        <View style={styles.messageList}>{messages.map((message) => <MessageBubble key={message.id} message={message} onOpenCitation={onOpenCitation} />)}</View>
        {error ? <Text accessibilityRole="alert" style={styles.processingError}>{error}</Text> : null}
        <View style={styles.sessionComposer}>
          <TextInput
            accessibilityLabel="Ask this session"
            value={query}
            onChangeText={setQuery}
            placeholder="Ask about a person, decision, action, date, or topic"
            placeholderTextColor={palette.inkFaint}
            multiline
            style={styles.askInput}
          />
          <Button label="Ask this session" fullWidth loading={busy} disabled={!query.trim() || busy} onPress={() => void submit()} />
        </View>
      </ScrollScreen>
    </View>
  );
}

function NotesWorkspace({ meeting, currentPositionMs, onAdd, onUpdate, onDelete, onSeek }: {
  meeting: Meeting;
  currentPositionMs: number;
  onAdd(text: string, linkedStartMs?: number): Promise<void>;
  onUpdate(noteId: string, text: string): Promise<void>;
  onDelete(noteId: string): Promise<void>;
  onSeek(startMs: number): void;
}) {
  const [draft, setDraft] = useState('');
  const [linkToAudio, setLinkToAudio] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await onAdd(draft, linkToAudio ? currentPositionMs : undefined);
      setDraft('');
      setLinkToAudio(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollScreen>
      <View style={styles.notesIntro}>
        <Text style={styles.eyebrow}>Your notes stay separate from the transcript</Text>
        <Text style={styles.askTitle}>Notes</Text>
        <Text style={styles.askDetail}>Capture interpretation, context, reminders, and corrections. Link a note to the current audio position when the recording is available.</Text>
      </View>
      <View style={styles.noteComposer}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Add a note" placeholderTextColor={palette.inkFaint} multiline style={styles.noteInput} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: linkToAudio }} onPress={() => setLinkToAudio((value) => !value)} style={styles.linkChoice}>
          <View style={[styles.smallCheckbox, linkToAudio && styles.smallCheckboxChecked]}>{linkToAudio ? <Text style={styles.smallCheck}>✓</Text> : null}</View>
          <Text style={styles.linkChoiceText}>Link to {formatTimestamp(currentPositionMs)}</Text>
        </Pressable>
        <Button label="Add note" fullWidth loading={busy} disabled={!draft.trim()} onPress={() => void add()} />
      </View>
      <View style={styles.section}>
        <SectionHeader title="Session notes" detail={`${meeting.notes?.length ?? 0} saved`} />
        <View style={styles.itemList}>
          {(meeting.notes ?? []).map((note) => <NoteEditor key={note.id} note={note} onUpdate={onUpdate} onDelete={onDelete} onSeek={onSeek} />)}
          {!meeting.notes?.length ? <Text style={styles.emptyLine}>No notes have been added.</Text> : null}
        </View>
      </View>
    </ScrollScreen>
  );
}

function NoteEditor({ note, onUpdate, onDelete, onSeek }: {
  note: SessionNote;
  onUpdate(noteId: string, text: string): Promise<void>;
  onDelete(noteId: string): Promise<void>;
  onSeek(startMs: number): void;
}) {
  const [value, setValue] = useState(note.text);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(note.text), [note.text]);
  const save = async () => {
    setBusy(true);
    try { await onUpdate(note.id, value); } finally { setBusy(false); }
  };
  return (
    <View style={styles.noteRow}>
      <TextInput value={value} onChangeText={setValue} multiline style={styles.noteEditorInput} />
      <Text style={styles.noteDate}>{new Date(note.updatedAt).toLocaleString()}</Text>
      <View style={styles.rowActions}>
        {note.linkedStartMs !== undefined ? <Button label={`Open ${formatTimestamp(note.linkedStartMs)}`} variant="quiet" onPress={() => onSeek(note.linkedStartMs!)} /> : null}
        <Button label="Save" variant="secondary" loading={busy} disabled={!value.trim() || value.trim() === note.text} onPress={() => void save()} />
        <Button label="Delete" variant="quiet" onPress={() => void onDelete(note.id)} />
      </View>
    </View>
  );
}

function ActionsWorkspace({ meeting, onUpdate, onSeek }: {
  meeting: Meeting;
  onUpdate(insightId: string, patch: Partial<Pick<Insight, 'owner' | 'dueText' | 'resolved' | 'text'>>): Promise<void>;
  onSeek(startMs: number): void;
}) {
  const actions = meeting.insights.filter((insight) => insight.kind === 'action');
  const open = actions.filter((action) => !action.resolved).length;
  return (
    <ScrollScreen>
      <View style={styles.actionHero}>
        <Text style={styles.eyebrow}>Outcome register</Text>
        <Text style={styles.askTitle}>{open} open action{open === 1 ? '' : 's'}</Text>
        <Text style={styles.askDetail}>Confirm the wording, assign an owner, add a due date, mark completion, and open the transcript evidence behind each automatically detected action.</Text>
      </View>
      <View style={styles.itemList}>
        {actions.map((action) => <ActionEditor key={action.id} insight={action} onUpdate={onUpdate} onSeek={onSeek} />)}
        {!actions.length ? <Text style={styles.emptyLine}>No explicit action items were captured in this session.</Text> : null}
      </View>
    </ScrollScreen>
  );
}

function ActionEditor({ insight, onUpdate, onSeek }: {
  insight: Insight;
  onUpdate(insightId: string, patch: Partial<Pick<Insight, 'owner' | 'dueText' | 'resolved' | 'text'>>): Promise<void>;
  onSeek(startMs: number): void;
}) {
  const [text, setText] = useState(insight.text);
  const [owner, setOwner] = useState(insight.owner ?? '');
  const [dueText, setDueText] = useState(insight.dueText ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText(insight.text);
    setOwner(insight.owner ?? '');
    setDueText(insight.dueText ?? '');
  }, [insight.dueText, insight.owner, insight.text]);

  const save = async () => {
    setBusy(true);
    try { await onUpdate(insight.id, { text: text.trim(), owner: owner.trim() || undefined, dueText: dueText.trim() || undefined }); } finally { setBusy(false); }
  };
  const changed = text.trim() !== insight.text || owner.trim() !== (insight.owner ?? '') || dueText.trim() !== (insight.dueText ?? '');
  return (
    <View style={[styles.actionEditor, insight.resolved && styles.resolvedAction]}>
      <View style={styles.actionHeader}>
        <Text style={styles.actionState}>{insight.resolved ? 'Completed' : 'Open'}</Text>
        <Text style={styles.actionTime}>{formatTimestamp(insight.evidenceStartMs)}</Text>
      </View>
      <TextInput value={text} onChangeText={setText} multiline style={styles.actionTextInput} />
      <View style={styles.actionFields}>
        <View style={styles.actionField}><Text style={styles.fieldLabel}>Owner</Text><TextInput value={owner} onChangeText={setOwner} placeholder="Unassigned" placeholderTextColor={palette.inkFaint} style={styles.compactInput} /></View>
        <View style={styles.actionField}><Text style={styles.fieldLabel}>Due</Text><TextInput value={dueText} onChangeText={setDueText} placeholder="Not captured" placeholderTextColor={palette.inkFaint} style={styles.compactInput} /></View>
      </View>
      <View style={styles.rowActions}>
        <Button label="Evidence" variant="quiet" onPress={() => onSeek(insight.evidenceStartMs)} />
        <Button label={insight.resolved ? 'Reopen' : 'Complete'} variant="secondary" onPress={() => void onUpdate(insight.id, { resolved: !insight.resolved })} />
        <Button label="Save" loading={busy} disabled={!changed || !text.trim()} onPress={() => void save()} />
      </View>
    </View>
  );
}

function InsightsWorkspace({ meeting, speakerNames, setSpeakerNames, onRenameSpeaker, onSeek, busyExport, onExport, onDelete }: {
  meeting: Meeting;
  speakerNames: Record<string, string>;
  setSpeakerNames(value: React.SetStateAction<Record<string, string>>): void;
  onRenameSpeaker(speakerId: string, displayName: string): Promise<void>;
  onSeek(startMs: number): void;
  busyExport?: ExportTemplate;
  onExport(template: ExportTemplate): Promise<void>;
  onDelete(): void;
}) {
  const summary = meeting.structuredSummary;
  const groups = insightGroups.map((group) => ({ ...group, items: meeting.insights.filter((insight) => insight.kind === group.kind) })).filter((group) => group.items.length);
  return (
    <ScrollScreen>
      <View style={styles.metrics}>
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

      <SummarySection title="Topics" items={summary?.topics ?? []} onOpenEvidence={onSeek} empty="No recurring topics were detected." />
      <SummarySection title="Key moments" items={summary?.keyMoments ?? []} onOpenEvidence={onSeek} empty="No key moments were detected." />

      {groups.map((group) => (
        <View key={group.kind} style={styles.section}>
          <SectionHeader title={group.title} detail={`${group.items.length} captured`} />
          <View style={styles.itemList}>{group.items.map((insight) => <InsightRow key={insight.id} insight={insight} onSeek={onSeek} />)}</View>
        </View>
      ))}

      <View style={styles.section}>
        <SectionHeader title="Speakers" detail="Correct anonymous labels without changing transcript evidence" />
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
            ['brief', 'Session brief'],
            ['minutes', 'Meeting minutes'],
            ['actions', 'Action register'],
            ['transcript', 'Full transcript']
          ] as Array<[ExportTemplate, string]>).map(([template, label]) => (
            <Button key={template} label={label} variant="secondary" loading={busyExport === template} disabled={Boolean(busyExport)} style={styles.exportButton} onPress={() => void onExport(template)} />
          ))}
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete session from this device</Text></Pressable>
    </ScrollScreen>
  );
}

function InsightRow({ insight, onSeek }: { insight: Insight; onSeek(startMs: number): void }) {
  return (
    <View style={styles.insightRow}>
      <View style={styles.outcomeHead}><Text style={styles.outcomeTime}>{formatTimestamp(insight.evidenceStartMs)}</Text><Text style={styles.outcomeConfidence}>{Math.round(insight.confidence * 100)}% confidence</Text></View>
      <Text style={styles.outcomeText}>{insight.text}</Text>
      <Button label="Open evidence" variant="quiet" onPress={() => onSeek(insight.evidenceStartMs)} />
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
  workspaceRoot: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl, backgroundColor: palette.canvas },
  notFoundTitle: { ...typography.heading, color: palette.ink },
  processingBanner: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, backgroundColor: palette.surface },
  processingCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  processingTitle: { ...typography.bodyStrong, color: palette.ink, flex: 1 },
  processingDetail: { ...typography.meta, color: palette.inkSubtle, textTransform: 'capitalize' },
  processingError: { color: palette.destructive },
  progressTrack: { height: 4, overflow: 'hidden', borderRadius: radius.round, backgroundColor: palette.line },
  progressFill: { height: '100%', backgroundColor: palette.dark },
  searchWrap: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  searchInput: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface, ...typography.body, color: palette.ink },
  searchMeta: { ...typography.meta, color: palette.inkSubtle },
  transcriptContent: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 100 },
  muted: { ...typography.body, color: palette.inkSubtle, textAlign: 'center', padding: spacing.xl },
  summaryHero: { gap: spacing.sm, marginBottom: spacing.xxl },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle, textTransform: 'capitalize' },
  summaryText: { ...typography.heading, color: palette.ink },
  verification: { ...typography.meta, color: palette.inkSubtle },
  section: { gap: spacing.md, marginBottom: spacing.xl },
  itemList: { gap: spacing.sm },
  summaryRow: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  summaryRowText: { ...typography.bodyStrong, color: palette.ink },
  summaryRowMeta: { ...typography.meta, color: palette.inkSubtle },
  evidenceButton: { alignSelf: 'flex-start', minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.round, borderWidth: 1, borderColor: palette.lineStrong },
  evidenceButtonText: { ...typography.meta, color: palette.primary, fontWeight: '700' },
  noEvidence: { ...typography.meta, color: palette.inkFaint },
  emptyLine: { ...typography.body, color: palette.inkSubtle, paddingVertical: spacing.sm },
  askIntro: { gap: spacing.xs, marginBottom: spacing.xl },
  askTitle: { ...typography.heading, color: palette.ink },
  askDetail: { ...typography.body, color: palette.inkSubtle },
  suggestions: { gap: spacing.sm, marginBottom: spacing.xl },
  suggestion: { minHeight: 50, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface },
  suggestionText: { ...typography.body, color: palette.ink },
  messageList: { gap: spacing.md },
  sessionComposer: { gap: spacing.sm, marginTop: spacing.xl },
  askInput: { minHeight: 94, maxHeight: 160, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface, ...typography.body, color: palette.ink, textAlignVertical: 'top' },
  notesIntro: { gap: spacing.xs, marginBottom: spacing.xl },
  noteComposer: { gap: spacing.sm, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.lg, backgroundColor: palette.surface },
  noteInput: { minHeight: 96, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surfaceRaised, ...typography.body, color: palette.ink, textAlignVertical: 'top' },
  linkChoice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallCheckbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.lineStrong, borderRadius: 5 },
  smallCheckboxChecked: { backgroundColor: palette.dark, borderColor: palette.dark },
  smallCheck: { color: palette.onDark, fontWeight: '700' },
  linkChoiceText: { ...typography.meta, color: palette.ink },
  noteRow: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  noteEditorInput: { minHeight: 70, padding: spacing.sm, borderWidth: 1, borderColor: palette.line, borderRadius: radius.sm, backgroundColor: palette.surfaceRaised, ...typography.body, color: palette.ink, textAlignVertical: 'top' },
  noteDate: { ...typography.meta, color: palette.inkSubtle },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs },
  actionHero: { gap: spacing.xs, marginBottom: spacing.xl },
  actionEditor: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.lg, backgroundColor: palette.surface },
  resolvedAction: { opacity: 0.7 },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  actionState: { ...typography.eyebrow, color: palette.inkSubtle },
  actionTime: { ...typography.mono, color: palette.inkSubtle },
  actionTextInput: { minHeight: 76, padding: spacing.sm, borderWidth: 1, borderColor: palette.line, borderRadius: radius.sm, backgroundColor: palette.surfaceRaised, ...typography.bodyStrong, color: palette.ink, textAlignVertical: 'top' },
  actionFields: { flexDirection: 'row', gap: spacing.sm },
  actionField: { flex: 1, gap: spacing.xs },
  fieldLabel: { ...typography.meta, color: palette.inkSubtle },
  compactInput: { minHeight: 46, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.sm, backgroundColor: palette.surface, ...typography.body, color: palette.ink },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  metric: { width: '47%', flexGrow: 1, minHeight: 94, padding: spacing.md, justifyContent: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  metricValue: { ...typography.heading, color: palette.ink },
  metricLabel: { ...typography.meta, color: palette.inkSubtle },
  completeness: { borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface, overflow: 'hidden' },
  completenessRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  completenessLabel: { ...typography.body, color: palette.ink },
  completenessValue: { ...typography.meta, color: palette.inkSubtle, textAlign: 'right' },
  insightRow: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  outcomeHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  outcomeTime: { ...typography.mono, color: palette.inkSubtle },
  outcomeConfidence: { ...typography.meta, color: palette.inkFaint },
  outcomeText: { ...typography.bodyStrong, color: palette.ink },
  speakers: { gap: spacing.sm },
  speakerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  speakerInput: { flex: 1, minHeight: 48, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface, ...typography.body, color: palette.ink },
  exportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exportButton: { width: '47%', flexGrow: 1 },
  deleteButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  deleteText: { ...typography.bodyStrong, color: palette.destructive }
});
