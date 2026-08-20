import type { CalendarEventContext } from '../domain/types.ts';

interface LegacyCalendar {
  id: string;
  title?: string;
  isVisible?: boolean;
  isSynced?: boolean;
}
interface LegacyEvent {
  id: string;
  calendarId: string;
  title?: string;
  startDate: string | Date;
  endDate: string | Date;
  location?: string;
  notes?: string;
  url?: string;
  organizer?: string;
}
interface LegacyAttendee { name?: string; email?: string }
interface LegacyCalendarModule {
  requestCalendarPermissionsAsync(): Promise<{ granted: boolean }>;
  getCalendarsAsync(entityType?: string): Promise<LegacyCalendar[]>;
  getEventsAsync(calendarIds: string[], startDate: Date, endDate: Date): Promise<LegacyEvent[]>;
  getAttendeesForEventAsync(eventId: string): Promise<LegacyAttendee[]>;
}

export async function loadUpcomingCalendarEvents(days = 30): Promise<CalendarEventContext[]> {
  const moduleId: string = 'expo-calendar/legacy';
  const Calendar = await import(moduleId) as unknown as LegacyCalendarModule;
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) throw new Error('Calendar access is required to show upcoming meetings.');

  const calendars = (await Calendar.getCalendarsAsync('event'))
    .filter((calendar) => calendar.isVisible !== false && calendar.isSynced !== false);
  const calendarIds = calendars.map((calendar) => calendar.id);
  if (!calendarIds.length) return [];
  const calendarNames = new Map(calendars.map((calendar) => [calendar.id, calendar.title]));
  const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const events = (await Calendar.getEventsAsync(calendarIds, start, end))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 60);

  const contexts = await Promise.all(events.map(async (event) => {
    const attendees = await Calendar.getAttendeesForEventAsync(event.id).catch(() => [] as LegacyAttendee[]);
    return {
      id: event.id,
      calendarId: event.calendarId,
      calendarTitle: calendarNames.get(event.calendarId),
      title: event.title?.trim() || 'Untitled calendar event',
      startAt: new Date(event.startDate).toISOString(),
      endAt: new Date(event.endDate).toISOString(),
      organizer: event.organizer,
      attendees: attendees.flatMap((attendee) => attendee.name?.trim() || attendee.email?.trim() || []).filter(Boolean),
      location: event.location,
      notes: event.notes,
      meetingUrl: event.url
    } satisfies CalendarEventContext;
  }));
  return contexts;
}
