export function formatDuration(milliseconds: number): string {
  const secondsTotal = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(secondsTotal / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = secondsTotal % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
}
export const formatTimestamp = formatDuration;
export function formatMeetingDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(iso));
}
export function formatRelativeMeetingDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return date.toDateString() === now.toDateString()
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
