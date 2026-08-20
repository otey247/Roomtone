import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const providerSource = readFileSync('src/inference/whisper-provider.ts', 'utf8');
const sessionSource = readFileSync('src/hooks/useMeetingSession.ts', 'utf8');

test('native realtime transcription wraps the raw Whisper VAD context before constructing RealtimeTranscriber', () => {
  assert.match(providerSource, /whisper\.rn\/realtime-transcription\/index/);
  assert.match(providerSource, /const realtimeVadContext = new RingBufferVad\(this\.rawVadContext,/);
  assert.match(providerSource, /vadContext:\s*realtimeVadContext/);
  assert.doesNotMatch(providerSource, /vadContext:\s*this\.rawVadContext/);
});

test('native realtime startup validates required constructors instead of surfacing undefined is not a function', () => {
  assert.match(providerSource, /requireConstructor<RealtimeTranscriberConstructor>/);
  assert.match(providerSource, /requireConstructor<RingBufferVadConstructor>/);
  assert.match(providerSource, /Live transcription could not start:/);
});

test('a failed native startup releases native resources before another attempt', () => {
  assert.match(sessionSource, /await runtime\.release\(\)/);
  assert.match(sessionSource, /status: 'failed'/);
});
