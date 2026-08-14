import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMeetingMetrics } from '../../src/domain/analytics.ts';
import { insight, segment } from './fixtures.ts';

test('meeting metrics calculate meeting-level dynamics and outcome completeness', () => {
  const segments = [
    segment({ id: 'one', speakerId: 'spk_jo', startMs: 0, endMs: 6_000 }),
    segment({ id: 'two', speakerId: 'spk_sarah', startMs: 6_000, endMs: 10_000 })
  ];
  const insights = [
    insight(),
    insight({ id: 'ins_2', owner: undefined, dueText: undefined }),
    insight({ id: 'ins_3', kind: 'decision', owner: undefined, dueText: undefined })
  ];
  const metrics = calculateMeetingMetrics(segments, 2, insights);
  assert.equal(metrics.totalTurns, 2);
  assert.equal(metrics.speakerCount, 2);
  assert.equal(metrics.averageTurnMs, 5_000);
  assert.equal(metrics.longestTurnMs, 6_000);
  assert.equal(metrics.actionCount, 2);
  assert.equal(metrics.actionsWithOwner, 1);
  assert.equal(metrics.actionsWithDueDate, 1);
});
