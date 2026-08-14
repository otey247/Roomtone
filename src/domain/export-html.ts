// Generates a local printable document only after an explicit user export action.
import { escape } from 'html-escaper';
import type { Meeting } from './types.ts';
import { meetingToPlainText } from './export-text.ts';

export type ExportTemplate = 'brief' | 'minutes' | 'transcript' | 'actions';

export { meetingToPlainText } from './export-text.ts';

export function meetingToHtml(meeting: Meeting, template: ExportTemplate = 'brief'): string {
  const documentText = meetingToPlainText(meeting, template);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Roomtone meeting export</title>
<style>
  @page { margin: 42px; }
  body { color: #111; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; }
  pre { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 10.5pt; line-height: 1.5; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
</head>
<body><pre>${escape(documentText)}</pre></body>
</html>`;
}
