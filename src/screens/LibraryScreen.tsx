import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MeetingRow } from '../components/MeetingRow.tsx';
import { ScrollScreen } from '../components/Screen.tsx';
import type { Meeting, SessionKind } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

type Filter = 'all' | SessionKind;
const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'voice_note', label: 'Voice notes' },
  { id: 'media', label: 'Imported media' },
  { id: 'lecture', label: 'Lectures' },
  { id: 'interview', label: 'Interviews' }
];

export function LibraryScreen({ meetings, onOpenMeeting }: { meetings: Meeting[]; onOpenMeeting(meetingId: string): void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return meetings.filter((meeting) => {
      if (filter !== 'all' && (meeting.kind ?? 'meeting') !== filter) return false;
      if (!normalized) return true;
      return [
        meeting.title,
        meeting.summary ?? '',
        meeting.source?.displayName ?? '',
        meeting.source?.provider ?? '',
        meeting.calendarEvent?.title ?? '',
        ...(meeting.tags ?? []),
        ...meeting.speakers.map((speaker) => speaker.displayName),
        ...meeting.segments.flatMap((segment) => [segment.originalText, segment.translatedText ?? '']),
        ...meeting.insights.map((insight) => insight.text),
        ...(meeting.notes ?? []).map((note) => note.text)
      ].some((value) => value.toLocaleLowerCase().includes(normalized));
    });
  }, [filter, meetings, query]);

  return (
    <ScrollScreen>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>On-device knowledge library</Text>
        <Text style={styles.title}>Sessions</Text>
        <Text style={styles.detail}>Every recording and import uses the same searchable transcript, summary, Ask, notes, actions, and evidence workspace.</Text>
      </View>
      <TextInput
        accessibilityLabel="Search sessions"
        value={query}
        onChangeText={setQuery}
        placeholder="Search sessions, people, topics or transcript text"
        placeholderTextColor={palette.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={styles.search}
      />
      <View style={styles.filters}>
        {filters.map((option) => {
          const selected = option.id === filter;
          return <Pressable key={option.id} onPress={() => setFilter(option.id)} style={[styles.filter, selected && styles.selectedFilter]}><Text style={[styles.filterText, selected && styles.selectedFilterText]}>{option.label}</Text></Pressable>;
        })}
      </View>
      <Text style={styles.count}>{filtered.length} of {meetings.length} session{meetings.length === 1 ? '' : 's'}</Text>
      <View style={styles.list}>
        {filtered.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} onPress={() => onOpenMeeting(meeting.id)} />)}
        {!filtered.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{meetings.length ? 'No matching sessions' : 'Your library is empty'}</Text>
            <Text style={styles.emptyText}>{meetings.length ? 'Try another source type, person, topic, or phrase.' : 'Record a meeting, create a voice note, import media, or load sample sessions from Settings.'}</Text>
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  filter: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.round, borderWidth: 1, borderColor: palette.lineStrong, backgroundColor: palette.surface },
  selectedFilter: { backgroundColor: palette.dark, borderColor: palette.dark },
  filterText: { ...typography.meta, color: palette.inkSubtle },
  selectedFilterText: { color: palette.onDark, fontWeight: '700' },
  count: { ...typography.meta, color: palette.inkSubtle, marginTop: spacing.md, marginBottom: spacing.md },
  list: { gap: spacing.sm },
  empty: { padding: spacing.xl, borderWidth: 1, borderColor: palette.line, borderRadius: radius.lg, backgroundColor: palette.surface, gap: spacing.sm },
  emptyTitle: { ...typography.subheading, color: palette.ink },
  emptyText: { ...typography.body, color: palette.inkSubtle }
});
