import { generateSummary } from './insights.ts';
import type {
  EvidenceReference,
  Insight,
  Meeting,
  StructuredSummary,
  SummaryItem,
  SummaryProfile,
  TranscriptSegment
} from './types.ts';

const stopWords = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'being',
  'but', 'can', 'could', 'did', 'does', 'for', 'from', 'have', 'here', 'into', 'just',
  'like', 'more', 'need', 'our', 'should', 'that', 'the', 'their', 'them', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'today', 'very', 'want', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'who', 'will', 'with', 'would', 'you', 'your'
]);

function profileFor(meeting: Meeting): SummaryProfile {
  switch (meeting.kind) {
    case 'lecture': return 'lecture';
    case 'interview': return 'interview';
    case 'voice_note': return 'voice_note';
    case 'media': return 'media';
    default: return 'business';
  }
}

function evidenceForSegment(meeting: Meeting, segment: TranscriptSegment): EvidenceReference {
  return {
    meetingId: meeting.id,
    segmentId: segment.id,
    startMs: segment.startMs,
    endMs: segment.endMs,
    quote: segment.originalText
  };
}

function itemForInsight(meeting: Meeting, insight: Insight): SummaryItem {
  const segment = meeting.segments.find((candidate) => candidate.id === insight.segmentId);
  return {
    id: `summary_${insight.kind}_${insight.id}`,
    text: insight.text,
    label: insight.kind === 'action'
      ? [insight.owner ? `Owner: ${insight.owner}` : undefined, insight.dueText ? `Due: ${insight.dueText}` : undefined]
        .filter(Boolean).join(' · ') || undefined
      : undefined,
    evidence: segment ? [evidenceForSegment(meeting, segment)] : []
  };
}

function tokens(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu)
    ?.map((token) => token.replace(/^['-]+|['-]+$/g, ''))
    .filter((token) => token.length > 2 && !stopWords.has(token)) ?? [];
}

function topicItems(meeting: Meeting): SummaryItem[] {
  const counts = new Map<string, number>();
  for (const segment of meeting.segments.filter((candidate) => candidate.isFinal)) {
    for (const token of new Set(tokens(segment.originalText))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= Math.min(2, Math.max(1, Math.floor(meeting.segments.length / 6))))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .flatMap(([term, count]) => {
      const segment = meeting.segments.find((candidate) =>
        new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(candidate.originalText)
      );
      if (!segment) return [];
      return [{
        id: `summary_topic_${term}`,
        text: term.replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase()),
        label: `${count} transcript turn${count === 1 ? '' : 's'}`,
        evidence: [evidenceForSegment(meeting, segment)]
      }];
    });
}

function keyMomentItems(meeting: Meeting): SummaryItem[] {
  const segmentIds = new Set(meeting.insights.map((insight) => insight.segmentId));
  const candidates = meeting.segments.filter((segment) => segmentIds.has(segment.id));
  for (const bookmark of meeting.bookmarks) {
    const nearest = meeting.segments.reduce<TranscriptSegment | undefined>((best, segment) => {
      if (!best) return segment;
      return Math.abs(segment.startMs - bookmark.startMs) < Math.abs(best.startMs - bookmark.startMs) ? segment : best;
    }, undefined);
    if (nearest && !candidates.some((segment) => segment.id === nearest.id)) candidates.push(nearest);
  }
  return candidates
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, 6)
    .map((segment) => ({
      id: `summary_moment_${segment.id}`,
      text: segment.originalText,
      evidence: [evidenceForSegment(meeting, segment)]
    }));
}

function notableQuotes(meeting: Meeting): SummaryItem[] {
  const insightSegmentIds = new Set(meeting.insights.map((insight) => insight.segmentId));
  return meeting.segments
    .filter((segment) => segment.isFinal && segment.originalText.length >= 38 && segment.originalText.length <= 320)
    .sort((a, b) => {
      const aScore = (insightSegmentIds.has(a.id) ? 2 : 0) + a.confidence;
      const bScore = (insightSegmentIds.has(b.id) ? 2 : 0) + b.confidence;
      return bScore - aScore || a.startMs - b.startMs;
    })
    .slice(0, 4)
    .map((segment) => ({
      id: `summary_quote_${segment.id}`,
      text: segment.originalText,
      evidence: [evidenceForSegment(meeting, segment)]
    }));
}

function followUps(meeting: Meeting): SummaryItem[] {
  const candidates = meeting.insights.filter((insight) =>
    (insight.kind === 'action' && !insight.resolved) || insight.kind === 'commitment'
  );
  return candidates.slice(0, 8).map((insight) => itemForInsight(meeting, insight));
}

export function buildStructuredSummary(meeting: Meeting): StructuredSummary {
  const finalSegments = meeting.segments.filter((segment) => segment.isFinal);
  const decisions = meeting.insights.filter((insight) => insight.kind === 'decision').map((insight) => itemForInsight(meeting, insight));
  const actions = meeting.insights.filter((insight) => insight.kind === 'action').map((insight) => itemForInsight(meeting, insight));
  const questions = meeting.insights.filter((insight) => insight.kind === 'question' && !insight.resolved).map((insight) => itemForInsight(meeting, insight));
  const risks = meeting.insights.filter((insight) => insight.kind === 'risk' && !insight.resolved).map((insight) => itemForInsight(meeting, insight));
  const fallback = meeting.summary || generateSummary(finalSegments, meeting.insights);
  return {
    profile: profileFor(meeting),
    generatedAt: new Date().toISOString(),
    executiveSummary: fallback || (finalSegments.length ? finalSegments.slice(0, 3).map((segment) => segment.originalText).join(' ') : ''),
    topics: topicItems(meeting),
    keyMoments: keyMomentItems(meeting),
    decisions,
    actionItems: actions,
    openQuestions: questions,
    risks,
    followUps: followUps(meeting),
    notableQuotes: notableQuotes(meeting)
  };
}
