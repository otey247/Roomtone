import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { KeywordDefinition, TranscriptSegment } from '../domain/types.ts';
import { KeywordMatcher } from '../domain/keywords.ts';
import { formatTimestamp } from '../utils/time.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

function HighlightedText({ text, keywords }: { text: string; keywords: KeywordDefinition[] }) {
  const matches = new KeywordMatcher(keywords).match(text).sort((a, b) => a.startCharacter - b.startCharacter);
  if (!matches.length) return <Text style={styles.text}>{text}</Text>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.startCharacter < cursor) return;
    parts.push(<Text key={`plain-${index}`}>{text.slice(cursor, match.startCharacter)}</Text>);
    parts.push(<Text key={`hit-${index}`} style={styles.highlight}>{text.slice(match.startCharacter, match.endCharacter)}</Text>);
    cursor = match.endCharacter;
  });
  parts.push(<Text key="tail">{text.slice(cursor)}</Text>);
  return <Text style={styles.text}>{parts}</Text>;
}

export function TranscriptRow({ segment, speakerName, keywords, isPartial = false, selected = false, onPress, onLongPress }: {
  segment: TranscriptSegment;
  speakerName: string;
  keywords: KeywordDefinition[];
  isPartial?: boolean;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable disabled={!onPress && !onLongPress} onPress={onPress} onLongPress={onLongPress} style={[styles.root, selected && styles.selected, isPartial && styles.partial]}>
      <View style={styles.metaLine}>
        <Text style={styles.speaker}>{speakerName}</Text>
        <Text style={styles.time}>{formatTimestamp(segment.startMs)}{isPartial ? ' · Listening' : ''}</Text>
      </View>
      <HighlightedText text={segment.originalText} keywords={keywords} />
      {segment.translatedText ? (
        <View style={styles.translation}>
          <Text style={styles.translationLabel}>English</Text>
          <Text style={styles.translationText}>{segment.translatedText}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  selected: { backgroundColor: palette.surfaceRaised },
  partial: { opacity: 0.62 },
  metaLine: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xs },
  speaker: { ...typography.bodyStrong, color: palette.ink },
  time: { ...typography.mono, color: palette.inkSubtle },
  text: { ...typography.body, color: palette.ink },
  highlight: { backgroundColor: palette.highlight, color: palette.ink, fontWeight: '700' },
  translation: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: palette.surfaceRaised },
  translationLabel: { ...typography.eyebrow, color: palette.inkSubtle, marginBottom: spacing.xxs },
  translationText: { ...typography.body, color: palette.inkSubtle }
});
