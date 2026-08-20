import type { Meeting, ModelState, Speaker, TranscriptSegment } from '../domain/types.ts';
import { createId } from '../utils/id.ts';

interface WhisperFileSegment { text?: string; t0?: number; t1?: number }
interface WhisperFileResult { result?: string; segments?: WhisperFileSegment[]; language?: string }
interface WhisperFileContext {
  transcribe(filePath: string, options: Record<string, unknown>): { promise: Promise<WhisperFileResult> };
  release?: () => Promise<void>;
}

export interface FileTranscriptResult {
  speakers: Speaker[];
  segments: TranscriptSegment[];
  detectedLanguage: string;
}

function speakerFor(meetingId: string, index: number, createdAt: string): Speaker {
  return {
    id: `${meetingId}_file_speaker_${index}`,
    meetingId,
    displayName: `Speaker ${index}`,
    isNamed: false,
    isEnrolled: false,
    createdAt
  };
}

function splitTurnText(text: string): string[] {
  return text.split(/\[SPEAKER_TURN\]/iu).map((part) => part.trim()).filter(Boolean);
}

export async function transcribeAudioFile(
  meeting: Meeting,
  model: ModelState,
  audioUri: string,
  durationMs: number
): Promise<FileTranscriptResult> {
  if (!model.installed || !model.localUri) throw new Error('Install and select a local speech model before importing media.');
  const whisperModuleId: string = 'whisper.rn';
  const { initWhisper } = await import(whisperModuleId);
  const context = await initWhisper({ filePath: model.localUri, useGpu: true }) as unknown as WhisperFileContext;

  try {
    const { promise } = context.transcribe(audioUri, {
      language: meeting.sourceLanguage || 'auto',
      translate: false,
      tokenTimestamps: true,
      tdrzEnable: model.supportsSpeakerTurns,
      maxThreads: 4
    });
    const result = await promise;
    const rawSegments = result.segments?.filter((segment) => segment.text?.trim()) ?? [];
    const fallback = result.result?.trim();
    const source = rawSegments.length
      ? rawSegments
      : fallback
        ? [{ text: fallback, t0: 0, t1: Math.max(1, Math.round(durationMs / 10)) }]
        : [];
    if (!source.length) throw new Error('The local speech model did not return a transcript for this file.');

    const createdAt = new Date().toISOString();
    const speakers: Speaker[] = [speakerFor(meeting.id, 1, createdAt)];
    const segments: TranscriptSegment[] = [];
    let speakerIndex = 1;
    let previousEndMs = 0;

    source.forEach((raw, rawIndex) => {
      const rawStartMs = Number.isFinite(raw.t0) ? Math.max(0, Number(raw.t0) * 10) : previousEndMs;
      const rawEndMs = Number.isFinite(raw.t1) ? Math.max(rawStartMs + 1, Number(raw.t1) * 10) : Math.max(rawStartMs + 1, durationMs);
      const parts = splitTurnText(raw.text ?? '');
      const safeParts = parts.length ? parts : [(raw.text ?? '').trim()].filter(Boolean);
      const span = Math.max(1, rawEndMs - rawStartMs);
      safeParts.forEach((text, partIndex) => {
        if (partIndex > 0 && model.supportsSpeakerTurns) {
          speakerIndex += 1;
          if (!speakers.some((speaker) => speaker.displayName === `Speaker ${speakerIndex}`)) {
            speakers.push(speakerFor(meeting.id, speakerIndex, createdAt));
          }
        }
        const startMs = rawStartMs + Math.round(span * partIndex / safeParts.length);
        const endMs = rawStartMs + Math.round(span * (partIndex + 1) / safeParts.length);
        segments.push({
          id: createId(`seg_file_${rawIndex}_${partIndex}`),
          meetingId: meeting.id,
          speakerId: `${meeting.id}_file_speaker_${speakerIndex}`,
          startMs,
          endMs,
          originalText: text,
          originalLanguage: result.language?.trim() || (meeting.sourceLanguage === 'auto' ? 'und' : meeting.sourceLanguage),
          confidence: 0.82,
          isFinal: true,
          words: [],
          transcriptionVersion: 1,
          diarizationVersion: model.supportsSpeakerTurns ? 1 : 0,
          createdAt,
          updatedAt: createdAt
        });
      });
      previousEndMs = rawEndMs;
    });

    return {
      speakers,
      segments,
      detectedLanguage: result.language?.trim() || (meeting.sourceLanguage === 'auto' ? 'und' : meeting.sourceLanguage)
    };
  } finally {
    await context.release?.();
  }
}
