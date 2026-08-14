import { createId } from '../utils/id.ts';
import type { Insight, Speaker, TranscriptSegment } from './types.ts';

const decisionPatterns = [
  /\b(?:we\s+)?(?:decided|agreed|approved)\b/i,
  /\bdecision\s*:/i,
  /\bwe(?:'ll|\s+will)\s+(?:go|move|proceed)\s+with\b/i,
  /\bthe decision is\b/i
];
const actionPatterns = [
  /\b(?:action item|next step)\s*:/i,
  /\b(?:i|we|you|[A-Z][a-z]+)\s+(?:will|'ll|need to|needs to|should|must)\b/i,
  /\blet(?:'s| us)\b/i,
  /\bplease\s+(?:send|create|review|confirm|schedule|update|share|prepare|follow up)\b/i
];
const riskPatterns = [/\b(?:risk|blocked|blocker|concern|dependency|depends on|threat)\b/i, /\bwe cannot\b/i];
const commitmentPatterns = [/\b(?:i|we)\s+(?:will|'ll|commit to|promise to)\b/i, /\bcommitment\s*:/i];
const dueDatePattern = /\b(?:(?:by|before|on|due)\s+)?((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|end of (?:the )?week|[A-Z][a-z]+\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?))\b/i;

function sentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((value) => value.trim()).filter((value) => value.length > 2);
}
function inferOwner(sentence: string, activeSpeaker?: Speaker): string | undefined {
  const named = sentence.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|'ll|needs to|should|must)\b/);
  if (named?.[1]) return named[1];
  if (/^I\s+(?:will|'ll|need to|should|must)\b/i.test(sentence)) return activeSpeaker?.isNamed ? activeSpeaker.displayName : undefined;
  return undefined;
}
function makeInsight(
  meetingId: string, segment: TranscriptSegment, kind: Insight['kind'], text: string,
  confidence: number, activeSpeaker?: Speaker
): Insight {
  return {
    id: createId('ins'), meetingId, segmentId: segment.id, kind,
    text: text.replace(/^(?:decision|action item|next step|risk|commitment)\s*:\s*/i, '').trim(),
    owner: kind === 'action' ? inferOwner(text, activeSpeaker) : undefined,
    dueText: kind === 'action' ? text.match(dueDatePattern)?.[1] : undefined,
    evidenceStartMs: segment.startMs, confidence, resolved: false,
    createdAt: new Date().toISOString()
  };
}
export function extractInsights(meetingId: string, segment: TranscriptSegment, speakers: Speaker[]): Insight[] {
  const active = speakers.find((speaker) => speaker.id === segment.speakerId);
  const result: Insight[] = [];
  for (const sentence of sentences(segment.originalText)) {
    if (decisionPatterns.some((pattern) => pattern.test(sentence))) result.push(makeInsight(meetingId, segment, 'decision', sentence, 0.84, active));
    if (actionPatterns.some((pattern) => pattern.test(sentence))) result.push(makeInsight(meetingId, segment, 'action', sentence, 0.74, active));
    if (sentence.endsWith('?')) result.push(makeInsight(meetingId, segment, 'question', sentence, 0.96, active));
    if (riskPatterns.some((pattern) => pattern.test(sentence))) result.push(makeInsight(meetingId, segment, 'risk', sentence, 0.70, active));
    if (commitmentPatterns.some((pattern) => pattern.test(sentence))) result.push(makeInsight(meetingId, segment, 'commitment', sentence, 0.68, active));
  }
  return deduplicateInsights(result);
}
export function deduplicateInsights(insights: Insight[]): Insight[] {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return insights.filter((insight, index, all) => all.findIndex((candidate) =>
    candidate.kind === insight.kind && normalize(candidate.text) === normalize(insight.text)
  ) === index);
}
export function generateSummary(segments: TranscriptSegment[], insights: Insight[]): string {
  if (!segments.length) return '';
  const decisions = insights.filter((item) => item.kind === 'decision').slice(0, 3);
  const actions = insights.filter((item) => item.kind === 'action').slice(0, 4);
  const questions = insights.filter((item) => item.kind === 'question' && !item.resolved).slice(0, 3);
  const sections: string[] = [];
  if (decisions.length) sections.push(`The meeting produced ${decisions.length} captured decision${decisions.length === 1 ? '' : 's'}, including ${decisions.map((item) => item.text).join('; ')}.`);
  if (actions.length) sections.push(`${actions.length} action item${actions.length === 1 ? ' was' : 's were'} identified: ${actions.map((item) => item.text).join('; ')}.`);
  if (questions.length) sections.push(`${questions.length} open question${questions.length === 1 ? ' remains' : 's remain'}: ${questions.map((item) => item.text).join('; ')}.`);
  if (sections.length) return sections.join(' ');
  const excerpt = segments.slice(-3).map((segment) => segment.originalText).join(' ');
  return excerpt.length > 420 ? `${excerpt.slice(0, 417)}...` : excerpt;
}
