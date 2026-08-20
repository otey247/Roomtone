import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoMeeting } from '../../src/data/demo.ts';
import { buildStructuredSummary } from '../../src/domain/session-analysis.ts';

test('structured session analysis keeps evidence-linked meeting intelligence sections', () => {
  const meeting = buildDemoMeeting();
  const summary = buildStructuredSummary(meeting);
  assert.equal(summary.profile, 'business');
  assert.ok(summary.executiveSummary.length > 40);
  assert.ok(summary.decisions.length >= 1);
  assert.ok(summary.actionItems.length >= 2);
  assert.ok(summary.openQuestions.length >= 1);
  assert.ok(summary.risks.length >= 1);
  assert.ok(summary.followUps.length >= 2);
  assert.ok(summary.notableQuotes.length >= 1);
  for (const item of [...summary.decisions, ...summary.actionItems, ...summary.openQuestions]) {
    assert.ok(item.evidence.length >= 1);
    assert.equal(item.evidence[0]?.meetingId, meeting.id);
    assert.ok((item.evidence[0]?.startMs ?? -1) >= 0);
  }
});

test('session analysis adapts its profile to lecture, interview, voice note, and media sessions', () => {
  const source = buildDemoMeeting();
  assert.equal(buildStructuredSummary({ ...source, kind: 'lecture' }).profile, 'lecture');
  assert.equal(buildStructuredSummary({ ...source, kind: 'interview' }).profile, 'interview');
  assert.equal(buildStructuredSummary({ ...source, kind: 'voice_note' }).profile, 'voice_note');
  assert.equal(buildStructuredSummary({ ...source, kind: 'media' }).profile, 'media');
});
