import { createId } from '../utils/id.ts';
import type { KeywordDefinition, KeywordOccurrence, TranscriptSegment } from './types.ts';

interface TrieNode {
  children: Map<string, TrieNode>;
  failure?: TrieNode;
  outputs: Array<{ keyword: KeywordDefinition; pattern: string }>;
}
export interface KeywordMatch {
  keyword: KeywordDefinition; matchedText: string;
  startCharacter: number; endCharacter: number;
}
const isWord = (value: string | undefined) => Boolean(value && /[\p{L}\p{N}_]/u.test(value));

export class KeywordMatcher {
  private readonly root: TrieNode = { children: new Map(), outputs: [] };
  constructor(definitions: KeywordDefinition[]) {
    for (const keyword of definitions.filter((item) => item.enabled)) {
      for (const source of [keyword.term, ...keyword.aliases]) {
        const pattern = source.trim().toLocaleLowerCase();
        if (!pattern) continue;
        let node = this.root;
        for (const character of pattern) {
          let child = node.children.get(character);
          if (!child) { child = { children: new Map(), outputs: [] }; node.children.set(character, child); }
          node = child;
        }
        node.outputs.push({ keyword, pattern });
      }
    }
    this.buildFailureLinks();
  }
  private buildFailureLinks(): void {
    const queue: TrieNode[] = [];
    this.root.failure = this.root;
    for (const child of this.root.children.values()) { child.failure = this.root; queue.push(child); }
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      for (const [character, child] of current.children) {
        let fallback = current.failure ?? this.root;
        while (fallback !== this.root && !fallback.children.has(character)) fallback = fallback.failure ?? this.root;
        if (fallback.children.has(character) && fallback.children.get(character) !== child) {
          fallback = fallback.children.get(character) ?? this.root;
        }
        child.failure = fallback;
        child.outputs.push(...fallback.outputs);
        queue.push(child);
      }
    }
  }
  match(text: string): KeywordMatch[] {
    const lower = text.toLocaleLowerCase();
    const matches: KeywordMatch[] = [];
    let node = this.root;
    for (let index = 0; index < lower.length; index += 1) {
      const character = lower[index] ?? '';
      while (node !== this.root && !node.children.has(character)) node = node.failure ?? this.root;
      node = node.children.get(character) ?? this.root;
      for (const output of node.outputs) {
        const endCharacter = index + 1;
        const startCharacter = endCharacter - output.pattern.length;
        if (startCharacter >= 0 && !isWord(lower[startCharacter - 1]) && !isWord(lower[endCharacter])) {
          matches.push({
            keyword: output.keyword,
            matchedText: text.slice(startCharacter, endCharacter),
            startCharacter, endCharacter
          });
        }
      }
    }
    return matches.filter((match, index, all) => all.findIndex((candidate) =>
      candidate.keyword.id === match.keyword.id && candidate.startCharacter === match.startCharacter && candidate.endCharacter === match.endCharacter
    ) === index);
  }
}

export function definitionsFromTerms(terms: string[]): KeywordDefinition[] {
  return terms.map((term) => term.trim()).filter(Boolean).filter((term, index, all) =>
    all.findIndex((candidate) => candidate.toLocaleLowerCase() === term.toLocaleLowerCase()) === index
  ).map((term) => ({ id: createId('kw'), term, aliases: [], enabled: true }));
}

export function occurrencesForSegment(
  meetingId: string, segment: TranscriptSegment, definitions: KeywordDefinition[]
): KeywordOccurrence[] {
  return new KeywordMatcher(definitions).match(segment.originalText).map((match) => ({
    id: createId('hit'), meetingId, keywordId: match.keyword.id, segmentId: segment.id,
    matchedText: match.matchedText, startCharacter: match.startCharacter,
    endCharacter: match.endCharacter, startMs: segment.startMs
  }));
}
