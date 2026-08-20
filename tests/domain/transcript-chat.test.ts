import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoMeeting, buildRecentDemoMeetings } from '../../src/data/demo.ts';
import { answerLibraryQuestion, answerSessionQuestion, createChatExchange } from '../../src/domain/transcript-chat.ts';

test('session chat answers action questions with timestamped transcript evidence', () => {
  const meeting = buildDemoMeeting();
  const answer = answerSessionQuestion(meeting, 'What did we commit to doing before Friday?');
  assert.match(answer.text, /architecture|privacy|Guard/i);
  assert.ok(answer.citations.length >= 1);
  assert.ok(answer.citations.some((citation) => citation.startMs === 36_700));
  assert.ok(answer.confidence >= 0.7);
});

test('session chat can compare a named speaker at the beginning and end', () => {
  const meeting = buildDemoMeeting();
  const answer = answerSessionQuestion(meeting, "Compare Sarah's position at the beginning with what she said at the end.");
  assert.ok(answer.citations.length >= 2);
  assert.match(answer.text, /Sarah/i);
});

test('library chat searches evidence across sessions without fabricating a response', () => {
  const meetings = buildRecentDemoMeetings();
  const answer = answerLibraryQuestion(meetings, 'What issues around security keep coming up?');
  assert.ok(answer.citations.length >= 2);
  assert.match(answer.text, /security|connectivity|identity/i);

  const missing = answerLibraryQuestion(meetings, 'What was the agreed catering menu?');
  assert.equal(missing.citations.length, 0);
  assert.match(missing.text, /could not find/i);
});

test('chat exchange preserves user and evidence-linked assistant messages', () => {
  const meeting = buildDemoMeeting();
  const answer = answerSessionQuestion(meeting, 'What decisions were made?');
  const messages = createChatExchange(meeting.id, 'What decisions were made?', answer, 'session');
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, 'user');
  assert.equal(messages[1]?.role, 'assistant');
  assert.ok((messages[1]?.citations.length ?? 0) >= 1);
});
