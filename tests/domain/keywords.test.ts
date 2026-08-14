import test from 'node:test';
import assert from 'node:assert/strict';
import { KeywordMatcher, definitionsFromTerms, occurrencesForSegment } from '../../src/domain/keywords.ts';
import { segment } from './fixtures.ts';

test('keyword matching honors word boundaries and preserves character offsets', () => {
  const [definition] = definitionsFromTerms(['security']);
  assert.ok(definition);
  const text = 'Security review is required; cybersecurity is a separate term.';
  const matches = new KeywordMatcher([definition]).match(text);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.matchedText, 'Security');
  assert.equal(text.slice(matches[0]?.startCharacter, matches[0]?.endCharacter), 'Security');
});

test('keyword occurrences are grounded in the source segment', () => {
  const definitions = definitionsFromTerms(['launch', 'privacy']);
  const source = segment({ originalText: 'The launch privacy review is Friday.', startMs: 12_000 });
  const occurrences = occurrencesForSegment(source.meetingId, source, definitions);
  assert.equal(occurrences.length, 2);
  assert.ok(occurrences.every((item) => item.segmentId === source.id));
  assert.ok(occurrences.every((item) => item.startMs === 12_000));
});
