export interface SpeakerCluster { id: string; centroid: number[]; sampleCount: number }
export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0, leftMagnitude = 0, rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0, b = right[index] ?? 0;
    dot += a * b; leftMagnitude += a * a; rightMagnitude += b * b;
  }
  return leftMagnitude && rightMagnitude ? dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)) : 0;
}
export function assignSpeakerCluster(
  embedding: number[], clusters: SpeakerCluster[], threshold = 0.78, createId: () => string
): { cluster: SpeakerCluster; clusters: SpeakerCluster[]; isNew: boolean } {
  const best = clusters.map((cluster) => ({ cluster, similarity: cosineSimilarity(cluster.centroid, embedding) }))
    .sort((a, b) => b.similarity - a.similarity)[0];
  if (!best || best.similarity < threshold) {
    const cluster = { id: createId(), centroid: [...embedding], sampleCount: 1 };
    return { cluster, clusters: [...clusters, cluster], isNew: true };
  }
  const count = best.cluster.sampleCount + 1;
  const updated = {
    ...best.cluster, sampleCount: count,
    centroid: best.cluster.centroid.map((value, index) => (value * best.cluster.sampleCount + (embedding[index] ?? 0)) / count)
  };
  return { cluster: updated, clusters: clusters.map((item) => item.id === updated.id ? updated : item), isNew: false };
}
