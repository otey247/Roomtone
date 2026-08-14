// Builds user-initiated local meeting documents from a visibly consented recording. It does not rank or score people.
import type { ExportTemplate, Meeting, Speaker } from './types.ts';
import { formatDuration, formatMeetingDate, formatTimestamp } from '../utils/time.ts';

function speakerLabel(speakers: Speaker[], speakerId: string): string {
  return speakers.find((speaker) => speaker.id === speakerId)?.displayName ?? 'Unknown speaker';
}

function outcomeLines(meeting: Meeting, kind: 'decision' | 'action' | 'question' | 'risk'): string[] {
  return meeting.insights.filter((item) => item.kind === kind).map((item) => {
    const context = kind === 'action'
      ? ` | Owner: ${item.owner ?? 'Unassigned'} | Due: ${item.dueText ?? 'Not captured'}`
      : '';
    return `- ${item.text}${context} [${formatTimestamp(item.evidenceStartMs)}]`;
  });
}

function dynamicsLines(meeting: Meeting): string[] {
  const ownerCoverage = meeting.metrics.actionCount
    ? Math.round(meeting.metrics.actionsWithOwner / meeting.metrics.actionCount * 100)
    : 0;
  const dueCoverage = meeting.metrics.actionCount
    ? Math.round(meeting.metrics.actionsWithDueDate / meeting.metrics.actionCount * 100)
    : 0;
  return [
    `Conversation turns: ${meeting.metrics.totalTurns}`,
    `Distinct speaker labels: ${meeting.metrics.speakerCount}`,
    `Questions: ${meeting.metrics.questionCount}`,
    `Decisions: ${meeting.metrics.decisionCount}`,
    `Actions: ${meeting.metrics.actionCount}`,
    `Average turn: ${formatDuration(meeting.metrics.averageTurnMs)}`,
    `Longest turn: ${formatDuration(meeting.metrics.longestTurnMs)}`,
    `Actions with an owner: ${ownerCoverage}%`,
    `Actions with a due date: ${dueCoverage}%`
  ];
}

function transcriptLines(meeting: Meeting): string[] {
  return meeting.segments.filter((segment) => segment.isFinal).flatMap((segment) => [
    `${formatTimestamp(segment.startMs)} · ${speakerLabel(meeting.speakers, segment.speakerId)}`,
    segment.originalText,
    ...(segment.translatedText ? [`English: ${segment.translatedText}`] : []),
    ''
  ]);
}

export function meetingToPlainText(meeting: Meeting, template: ExportTemplate = 'brief'): string {
  const lines = [
    meeting.title,
    `${formatMeetingDate(meeting.startedAt)} · ${formatDuration(meeting.metrics.durationMs)}`,
    'Generated locally by Roomtone. Verify automated observations against the transcript timestamps.',
    ''
  ];
  if (template !== 'transcript' && template !== 'actions') {
    lines.push('SUMMARY', meeting.summary || 'No summary was generated.', '');
  }
  if (template === 'brief' || template === 'minutes') {
    lines.push('MEETING DYNAMICS', ...dynamicsLines(meeting), '');
  }
  if (template !== 'transcript') {
    lines.push('DECISIONS', ...outcomeLines(meeting, 'decision'), '');
    lines.push('ACTION ITEMS', ...outcomeLines(meeting, 'action'), '');
  }
  if (template !== 'transcript' && template !== 'actions') {
    lines.push('OPEN QUESTIONS', ...outcomeLines(meeting, 'question'), '');
    lines.push('RISKS AND DEPENDENCIES', ...outcomeLines(meeting, 'risk'), '');
  }
  if (template === 'transcript' || template === 'minutes') {
    lines.push('TRANSCRIPT', ...transcriptLines(meeting));
  }
  return lines.join('\n');
}
