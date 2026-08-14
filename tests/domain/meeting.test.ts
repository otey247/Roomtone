import test from 'node:test';
import assert from 'node:assert/strict';
import { addBookmark, addFinalSegment, createMeeting, finishMeeting, renameSpeaker } from '../../src/domain/meeting.ts';
import { segment } from './fixtures.ts';

test('meeting reducer derives keywords, outcomes, metrics, and a summary from final transcript', () => {
  const meeting = createMeeting({
    title: 'Architecture review',
    runtime: 'demo',
    sourceLanguage: 'en',
    translationMode: 'off',
    keywords: ['security'],
    consentAcknowledged: true
  });
  const source = segment({
    meetingId: meeting.id,
    speakerId: meeting.speakers[0]?.id,
    originalText: 'We agreed to proceed. Jo will complete the security review by Friday.'
  });
  const updated = addFinalSegment(meeting, source);
  assert.equal(updated.segments.length, 1);
  assert.equal(updated.keywordOccurrences.length, 1);
  assert.ok(updated.insights.some((item) => item.kind === 'decision'));
  assert.ok(updated.insights.some((item) => item.kind === 'action'));
  assert.equal(updated.metrics.totalTurns, 1);
  assert.ok(updated.summary);
});

test('speaker edits, bookmarks, and meeting completion preserve local meeting state', () => {
  const meeting = createMeeting({
    title: 'Weekly review', runtime: 'demo', sourceLanguage: 'auto',
    translationMode: 'english', keywords: [], consentAcknowledged: true
  });
  const speakerId = meeting.speakers[0]?.id;
  assert.ok(speakerId);
  const renamed = renameSpeaker(meeting, speakerId, 'Sarah');
  const bookmarked = addBookmark(renamed, 4_200, 'Key decision');
  const finished = finishMeeting(bookmarked, 'file:///meeting.wav');
  assert.equal(finished.speakers[0]?.displayName, 'Sarah');
  assert.equal(finished.bookmarks[0]?.startMs, 4_200);
  assert.equal(finished.status, 'complete');
  assert.equal(finished.audioUri, 'file:///meeting.wav');
});
