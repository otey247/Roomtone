import * as Clipboard from 'expo-clipboard';
import type { Meeting, TranscriptSegment } from '../domain/types.ts';
import { meetingToPlainText } from '../domain/export-text.ts';
import { formatTimestamp } from '../utils/time.ts';

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function copyMeeting(meeting: Meeting): Promise<void> {
  await copyText(meetingToPlainText(meeting));
}

export async function copySegment(meeting: Meeting, segment: TranscriptSegment): Promise<void> {
  const speaker = meeting.speakers.find((item) => item.id === segment.speakerId)?.displayName ?? 'Unknown speaker';
  const translation = segment.translatedText ? `\nEnglish: ${segment.translatedText}` : '';
  await copyText(`${formatTimestamp(segment.startMs)} · ${speaker}\n${segment.originalText}${translation}`);
}
