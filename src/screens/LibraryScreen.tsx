import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { MeetingRow } from '../components/MeetingRow.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import type { Meeting } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

export function LibraryScreen({ meetings, onOpenMeeting }: { meetings: Meeting[]; onOpenMeeting(meetingId: string): void }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return meetings;
    return meetings.filter((meeting) => [
      meeting.title,
      meeting.summary ?? '',
      ...meeting.speakers.map((speaker) => speaker.displayName),
      ...meeting.segments.flatMap((segment) => [segment.originalText, segment.translatedText ?? '']),
      ...meeting.insights.map((insight) => insight.text)
    ].some((value) => value.toLocaleLowerCase().includes(normalized)));
  }, [meetings, query]);

  return (
    <ScrollScreen>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>On-device library</Text>
        <Text style={styles.title}>Meetings</Text>
        <Text style={styles.detail}>Search titles, speakers, transcript text, translations, and captured outcomes.</Text>
      </View>
      <TextInput
        accessibilityLabel="Search meetings"
        value={query}
        onChangeText={setQuery}
        placeholder="Search meetings"
        placeholderTextColor={palette.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={styles.search}
      />
      <Text style={styles.count}>{filtered.length} of {meetings.length} meeting{meetings.length === 1 ? '' : 's'}</Text>
      <View style={styles.list}>
        {filtered.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onPress={() => onOpenMeeting(meeting.id)} />)}
        {!filtered.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{meetings.length ? 'No matching meetings' : 'Your library is empty'}</Text>
            <Text style={styles.emptyText}>{meetings.length ? 'Try a title, speaker, keyword, or phrase from the transcript.' : 'Complete a meeting or load the sample meetings from Settings.'}</Text>
          </View>
        ) : null}
      </View>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs, marginBottom: spacing.lg },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  title: { ...typography.title, color: palette.ink },
  detail: { ...typography.body, color: palette.inkSubtle },
  search: { minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.lineStrong, backgroundColor: palette.surface, ...typography.body, color: palette.ink },
  count: { ...typography.meta, color: palette.inkSubtle, marginTop: spacing.sm, marginBottom: spacing.md },
  list: { gap: spacing.sm },
  empty: { padding: spacing.xl, borderWidth: 1, borderColor: palette.line, borderRadius: radius.lg, backgroundColor: palette.surface, gap: spacing.sm },
  emptyTitle: { ...typography.subheading, color: palette.ink },
  emptyText: { ...typography.body, color: palette.inkSubtle }
});
