// Privacy boundary: this module reports meeting-level workflow measures only. It never ranks, scores, or evaluates individual people.
import type { Insight, MeetingMetrics, TranscriptSegment } from './types.ts';

export function calculateMeetingMetrics(
  segments: TranscriptSegment[], speakerCount: number, insights: Insight[], durationMs?: number
): MeetingMetrics {
  const finalSegments = segments.filter((item) => item.isFinal);
  const longestTurnMs = finalSegments.reduce(
    (longest, segment) => Math.max(longest, Math.max(0, segment.endMs - segment.startMs)),
    0
  );
  const totalSpeechMs = finalSegments.reduce(
    (total, segment) => total + Math.max(0, segment.endMs - segment.startMs),
    0
  );
  const actions = insights.filter((insight) => insight.kind === 'action');
  const inferredDuration = finalSegments.reduce((latest, segment) => Math.max(latest, segment.endMs), 0);
  return {
    durationMs: Math.max(durationMs ?? 0, inferredDuration),
    totalTurns: finalSegments.length,
    speakerCount,
    averageTurnMs: finalSegments.length ? Math.round(totalSpeechMs / finalSegments.length) : 0,
    questionCount: insights.filter((insight) => insight.kind === 'question').length,
    decisionCount: insights.filter((insight) => insight.kind === 'decision').length,
    actionCount: actions.length,
    actionsWithOwner: actions.filter((insight) => Boolean(insight.owner)).length,
    actionsWithDueDate: actions.filter((insight) => Boolean(insight.dueText)).length,
    longestTurnMs
  };
}

export const emptyMeetingMetrics: MeetingMetrics = {
  durationMs: 0,
  totalTurns: 0,
  speakerCount: 0,
  averageTurnMs: 0,
  questionCount: 0,
  decisionCount: 0,
  actionCount: 0,
  actionsWithOwner: 0,
  actionsWithDueDate: 0,
  longestTurnMs: 0
};
