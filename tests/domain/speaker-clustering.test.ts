import test from 'node:test';
import assert from 'node:assert/strict';
import { assignSpeakerCluster, cosineSimilarity } from '../../src/domain/speaker-clustering.ts';

test('cosine similarity distinguishes aligned and opposing embeddings', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
  assert.equal(cosineSimilarity([], []), 0);
});

test('speaker clustering reuses close clusters and creates a new cluster below threshold', () => {
  let nextId = 1;
  const createId = () => `speaker_${nextId++}`;
  const first = assignSpeakerCluster([1, 0], [], 0.8, createId);
  assert.equal(first.isNew, true);
  const close = assignSpeakerCluster([0.98, 0.02], first.clusters, 0.8, createId);
  assert.equal(close.isNew, false);
  assert.equal(close.cluster.id, first.cluster.id);
  const distant = assignSpeakerCluster([0, 1], close.clusters, 0.8, createId);
  assert.equal(distant.isNew, true);
  assert.equal(distant.clusters.length, 2);
});
