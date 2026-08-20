import { createId } from '../utils/id.ts';
import type {
  ChatMessage,
  ChatScope,
  GroundedAnswer,
  InsightKind,
  Meeting,
  TranscriptCitation,
  TranscriptSegment
} from './types.ts';

const ignored = new Set([
  'about', 'after', 'all', 'and', 'any', 'are', 'can', 'could', 'did', 'does', 'for',
  'from', 'have', 'how', 'into', 'meeting', 'more', 'said', 'say', 'that', 'the', 'their',
  'them', 'there', 'these', 'they', 'this', 'those', 'was', 'were', 'what', 'when', 'where',
  'which', 'who', 'will', 'with', 'would', 'you', 'your'
]);

function normalizedTokens(value: string): string[] {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{1,}/gu)
    ?.filter((token) => token.length > 1 && !ignored.has(token)) ?? [];
}

function citationFor(meeting: Meeting, segment: TranscriptSegment): TranscriptCitation {
  const speaker = meeting.speakers.find((candidate) => candidate.id === segment.speakerId);
  return {
    meetingId: meeting.id,
    meetingTitle: meeting.title,
    segmentId: segment.id,
    startMs: segment.startMs,
    endMs: segment.endMs,
    quote: segment.originalText,
    speakerName: speaker?.displayName
  };
}

function uniqueCitations(citations: TranscriptCitation[]): TranscriptCitation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.meetingId}:${citation.segmentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function kindFromQuestion(question: string): InsightKind | undefined {
  if (/\b(?:action|task|next step|follow[- ]?up|commitment)\b/i.test(question)) return 'action';
  if (/\b(?:decision|decided|agreed|approved)\b/i.test(question)) return 'decision';
  if (/\b(?:risk|blocker|blocked|concern|dependency)\b/i.test(question)) return 'risk';
  if (/\b(?:open question|unresolved|question)\b/i.test(question)) return 'question';
  return undefined;
}

function speakerMention(meeting: Meeting, question: string): string | undefined {
  const normalized = question.toLocaleLowerCase();
  return meeting.speakers.find((speaker) =>
    speaker.isNamed && normalized.includes(speaker.displayName.toLocaleLowerCase())
  )?.id;
}

function rankedSegments(meeting: Meeting, question: string): Array<{ segment: TranscriptSegment; score: number }> {
  const queryTokens = normalizedTokens(question);
  const querySet = new Set(queryTokens);
  const speakerId = speakerMention(meeting, question);
  const insightSegmentIds = new Set(meeting.insights
    .filter((insight) => normalizedTokens(insight.text).some((token) => querySet.has(token)))
    .map((insight) => insight.segmentId));
  return meeting.segments
    .filter((segment) => segment.isFinal && (!speakerId || segment.speakerId === speakerId))
    .map((segment) => {
      const textTokens = normalizedTokens(`${segment.originalText} ${segment.translatedText ?? ''}`);
      const overlap = textTokens.reduce((score, token) => score + (querySet.has(token) ? 1 : 0), 0);
      const phraseBonus = queryTokens.some((token) => segment.originalText.toLocaleLowerCase().includes(token)) ? 0.5 : 0;
      const insightBonus = insightSegmentIds.has(segment.id) ? 1.5 : 0;
      return { segment, score: overlap + phraseBonus + insightBonus };
    })
    .sort((a, b) => b.score - a.score || a.segment.startMs - b.segment.startMs);
}

function answerFromInsights(meeting: Meeting, question: string, kind: InsightKind): GroundedAnswer {
  let insights = meeting.insights.filter((insight) => insight.kind === kind);
  if (kind === 'action' && /\b(?:open|outstanding|remaining|unresolved)\b/i.test(question)) {
    insights = insights.filter((insight) => !insight.resolved);
  }
  if (!insights.length) {
    return { text: `I could not find a captured ${kind} in this transcript.`, citations: [], confidence: 0.25 };
  }
  const citations = uniqueCitations(insights.flatMap((insight) => {
    const segment = meeting.segments.find((candidate) => candidate.id === insight.segmentId);
    return segment ? [citationFor(meeting, segment)] : [];
  }));
  const lines = insights.slice(0, 8).map((insight) => {
    if (kind !== 'action') return `• ${insight.text}`;
    const metadata = [
      insight.owner ? `owner: ${insight.owner}` : 'owner not captured',
      insight.dueText ? `due: ${insight.dueText}` : 'due date not captured',
      insight.resolved ? 'completed' : 'open'
    ].join(', ');
    return `• ${insight.text} (${metadata})`;
  });
  return {
    text: `${kind === 'action' ? 'Action items' : `${kind[0]?.toLocaleUpperCase()}${kind.slice(1)}s`} found in ${meeting.title}:\n${lines.join('\n')}`,
    citations,
    confidence: 0.9
  };
}

function compareSpeakerPosition(meeting: Meeting, question: string): GroundedAnswer | undefined {
  if (!/\b(?:beginning|start|initial|first)\b/i.test(question) || !/\b(?:end|ending|final|later)\b/i.test(question)) return undefined;
  const speakerId = speakerMention(meeting, question);
  const segments = meeting.segments.filter((segment) => segment.isFinal && (!speakerId || segment.speakerId === speakerId));
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!first || !last || first.id === last.id) return undefined;
  const speaker = meeting.speakers.find((candidate) => candidate.id === first.speakerId)?.displayName ?? 'The speaker';
  return {
    text: `${speaker} began by saying: “${first.originalText}” Later, the final relevant statement was: “${last.originalText}”`,
    citations: [citationFor(meeting, first), citationFor(meeting, last)],
    confidence: 0.82
  };
}

function emailDraft(meeting: Meeting): GroundedAnswer {
  const actions = meeting.insights.filter((insight) => insight.kind === 'action' || insight.kind === 'commitment').slice(0, 6);
  const citations = uniqueCitations(actions.flatMap((insight) => {
    const segment = meeting.segments.find((candidate) => candidate.id === insight.segmentId);
    return segment ? [citationFor(meeting, segment)] : [];
  }));
  const actionText = actions.length
    ? actions.map((insight) => `• ${insight.text}`).join('\n')
    : '• No explicit commitments were captured.';
  return {
    text: `Subject: Follow-up from ${meeting.title}\n\nThanks for the discussion. Here is my understanding of the agreed follow-up:\n\n${actionText}\n\nPlease reply with any corrections or missing owners and dates.`,
    citations,
    confidence: actions.length ? 0.86 : 0.45
  };
}

export function answerSessionQuestion(meeting: Meeting, question: string): GroundedAnswer {
  const trimmed = question.trim();
  if (!trimmed) return { text: 'Ask a question about this session.', citations: [], confidence: 0 };
  if (/\b(?:email|follow-up message|follow up message)\b/i.test(trimmed)) return emailDraft(meeting);
  const comparison = compareSpeakerPosition(meeting, trimmed);
  if (comparison) return comparison;
  const insightKind = kindFromQuestion(trimmed);
  if (insightKind) return answerFromInsights(meeting, trimmed, insightKind);
  if (/\b(?:summary|summarize|recap|overview)\b/i.test(trimmed)) {
    const citations = meeting.segments.filter((segment) => segment.isFinal).slice(0, 3).map((segment) => citationFor(meeting, segment));
    return {
      text: meeting.structuredSummary?.executiveSummary || meeting.summary || 'No summary has been generated yet.',
      citations,
      confidence: citations.length ? 0.82 : 0.3
    };
  }

  const ranked = rankedSegments(meeting, trimmed).filter((candidate) => candidate.score > 0).slice(0, 4);
  if (!ranked.length) {
    return {
      text: 'I could not find transcript evidence that answers that question. Try a participant name, topic, decision, action, or exact phrase.',
      citations: [],
      confidence: 0.2
    };
  }
  const citations = ranked.map(({ segment }) => citationFor(meeting, segment));
  const response = ranked.slice(0, 3).map(({ segment }) => {
    const speaker = meeting.speakers.find((candidate) => candidate.id === segment.speakerId)?.displayName ?? 'Speaker';
    return `${speaker}: “${segment.originalText}”`;
  }).join('\n\n');
  return { text: response, citations, confidence: Math.min(0.88, 0.52 + ranked[0]!.score * 0.08) };
}

export function answerLibraryQuestion(meetings: Meeting[], question: string): GroundedAnswer {
  const trimmed = question.trim();
  if (!trimmed) return { text: 'Ask a question across your sessions.', citations: [], confidence: 0 };
  const kind = kindFromQuestion(trimmed);
  if (kind) {
    const perMeeting = meetings.flatMap((meeting) => {
      let insights = meeting.insights.filter((insight) => insight.kind === kind);
      if (kind === 'action' && /\b(?:open|outstanding|remaining|unresolved)\b/i.test(trimmed)) {
        insights = insights.filter((insight) => !insight.resolved);
      }
      return insights.map((insight) => ({ meeting, insight }));
    }).slice(0, 12);
    if (perMeeting.length) {
      const citations = uniqueCitations(perMeeting.flatMap(({ meeting, insight }) => {
        const segment = meeting.segments.find((candidate) => candidate.id === insight.segmentId);
        return segment ? [citationFor(meeting, segment)] : [];
      }));
      return {
        text: perMeeting.map(({ meeting, insight }) => `• ${meeting.title}: ${insight.text}`).join('\n'),
        citations,
        confidence: 0.9
      };
    }
  }

  const candidates = meetings.flatMap((meeting) =>
    rankedSegments(meeting, trimmed).slice(0, 3).map(({ segment, score }) => ({ meeting, segment, score }))
  ).filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.meeting.updatedAt.localeCompare(a.meeting.updatedAt))
    .slice(0, 6);

  if (!candidates.length) {
    return {
      text: 'I could not find matching evidence in the sessions stored on this device.',
      citations: [],
      confidence: 0.2
    };
  }
  const citations = uniqueCitations(candidates.map(({ meeting, segment }) => citationFor(meeting, segment)));
  const text = candidates.slice(0, 5).map(({ meeting, segment }) => {
    const speaker = meeting.speakers.find((candidate) => candidate.id === segment.speakerId)?.displayName ?? 'Speaker';
    return `• ${meeting.title} · ${speaker}: “${segment.originalText}”`;
  }).join('\n');
  return { text, citations, confidence: Math.min(0.88, 0.5 + candidates[0]!.score * 0.08) };
}

export function createChatExchange(
  meetingId: string | undefined,
  question: string,
  answer: GroundedAnswer,
  scope: ChatScope
): ChatMessage[] {
  const now = new Date().toISOString();
  return [
    {
      id: createId('chat'),
      meetingId,
      role: 'user',
      text: question.trim(),
      createdAt: now,
      scope,
      citations: []
    },
    {
      id: createId('chat'),
      meetingId,
      role: 'assistant',
      text: answer.text,
      createdAt: new Date(Date.now() + 1).toISOString(),
      scope,
      citations: answer.citations
    }
  ];
}
