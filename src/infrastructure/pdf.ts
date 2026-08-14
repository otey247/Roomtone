import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { meetingToHtml } from '../domain/export-html.ts';
import type { ExportTemplate, Meeting } from '../domain/types.ts';

export async function exportMeetingPdf(meeting: Meeting, template: ExportTemplate): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: meetingToHtml(meeting, template) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      UTI: 'com.adobe.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Export ${meeting.title}`
    });
  }
  return uri;
}
