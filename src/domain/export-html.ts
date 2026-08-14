// Generates a local printable document only after an explicit user export action.
import type { ExportTemplate, Meeting } from './types.ts';
import { meetingToPlainText } from './export-text.ts';

export type { ExportTemplate } from './types.ts';
export { meetingToPlainText } from './export-text.ts';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character);
}

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
<body><pre>${escapeHtml(documentText)}</pre></body>
</html>`;
}
