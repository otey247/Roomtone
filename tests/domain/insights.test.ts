import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInsights, generateSummary } from '../../src/domain/insights.ts';
import { segment, speaker } from './fixtures.ts';

test('insight extraction links an action owner and due date to evidence', () => {
  const source = segment({ originalText: 'Jo will send the architecture review by Friday.' });
  const results = extractInsights(source.meetingId, source, [speaker()]);
  const action = results.find((item) => item.kind === 'action');
  assert.ok(action);
  assert.equal(action.owner, 'Jo');
  assert.equal(action.dueText?.toLocaleLowerCase(), 'friday');
  assert.equal(action.segmentId, source.id);
  assert.equal(action.evidenceStartMs, source.startMs);
});

test('insight extraction and summary preserve decisions, questions, and risks', () => {
  const source = segment({
    originalText: 'We agreed to proceed with the local beta. Does security require a service identity? Private connectivity remains a risk.'
  });
  const results = extractInsights(source.meetingId, source, [speaker()]);
  assert.ok(results.some((item) => item.kind === 'decision'));
  assert.ok(results.some((item) => item.kind === 'question'));
  assert.ok(results.some((item) => item.kind === 'risk'));
  const summary = generateSummary([source], results);
  assert.match(summary, /decision/i);
  assert.match(summary, /question/i);
});
