import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import type { CalendarEventContext } from '../domain/types.ts';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';

interface CalendarScreenProps {
  loadEvents(): Promise<CalendarEventContext[]>;
  onStartEvent(event: CalendarEventContext): void;
}

export function CalendarScreen({ loadEvents, onStartEvent }: CalendarScreenProps) {
  const [events, setEvents] = useState<CalendarEventContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setEvents(await loadEvents());
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upcoming calendar events could not be loaded.');
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [loadEvents]);

  useEffect(() => { void refresh(); }, [refresh]);

  const groups = useMemo(() => {
    const map = new Map<string, CalendarEventContext[]>();
    events.forEach((event) => {
      const key = new Date(event.startAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return [...map.entries()];
  }, [events]);

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      contentContainerStyle={styles.content}
      style={styles.root}
    >
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Device calendar context</Text>
        <Text style={styles.title}>Upcoming</Text>
        <Text style={styles.detail}>Start a recording from a synchronized device-calendar event so Roomtone already knows the title, time, expected participants, location, and meeting link.</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Calendar unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Try again" variant="secondary" onPress={() => void refresh()} />
        </View>
      ) : null}

      {groups.map(([date, dateEvents]) => (
        <View key={date} style={styles.group}>
          <Text style={styles.date}>{date}</Text>
          <View style={styles.eventList}>
            {dateEvents.map((event) => <CalendarEventRow key={`${event.calendarId}:${event.id}`} event={event} onStart={() => onStartEvent(event)} />)}
          </View>
        </View>
      ))}

      {loaded && !loading && !error && !events.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No upcoming events found</Text>
          <Text style={styles.emptyText}>Make sure the calendar is synchronized and visible on this phone, then pull down to refresh.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function CalendarEventRow({ event, onStart }: { event: CalendarEventContext; onStart(): void }) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const time = `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}–${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  return (
    <Pressable accessibilityRole="button" onPress={onStart} style={styles.event}>
      <View style={styles.eventTime}><Text style={styles.eventTimeText}>{time}</Text><Text style={styles.calendarName}>{event.calendarTitle ?? 'Calendar'}</Text></View>
      <View style={styles.eventCopy}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventMeta}>{event.attendees.length ? `${event.attendees.length} expected participant${event.attendees.length === 1 ? '' : 's'}` : 'No attendee list'}{event.location ? ` · ${event.location}` : ''}</Text>
        <Text style={styles.eventAction}>Prepare recording</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  heading: { gap: spacing.xs, marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: palette.inkSubtle },
  title: { ...typography.title, color: palette.ink },
  detail: { ...typography.body, color: palette.inkSubtle },
  group: { gap: spacing.sm, marginBottom: spacing.xl },
  date: { ...typography.subheading, color: palette.ink },
  eventList: { gap: spacing.sm },
  event: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface },
  eventTime: { width: 92, gap: spacing.xs },
  eventTimeText: { ...typography.meta, color: palette.ink, fontWeight: '700' },
  calendarName: { ...typography.meta, color: palette.inkSubtle },
  eventCopy: { flex: 1, gap: spacing.xs },
  eventTitle: { ...typography.bodyStrong, color: palette.ink },
  eventMeta: { ...typography.meta, color: palette.inkSubtle },
  eventAction: { ...typography.meta, color: palette.primary, fontWeight: '700', marginTop: spacing.xs },
  errorBox: { gap: spacing.sm, padding: spacing.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.md, backgroundColor: palette.surface },
  errorTitle: { ...typography.bodyStrong, color: palette.ink },
  errorText: { ...typography.body, color: palette.destructive },
  empty: { gap: spacing.sm, padding: spacing.xl, borderWidth: 1, borderColor: palette.line, borderRadius: radius.lg, backgroundColor: palette.surface },
  emptyTitle: { ...typography.subheading, color: palette.ink },
  emptyText: { ...typography.body, color: palette.inkSubtle }
});
