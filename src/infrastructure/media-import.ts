import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import MediaNormalizer from '../../modules/roomtone-media-normalizer/index.ts';
import { finishMeeting, replaceTranscript, updateSource } from '../domain/meeting.ts';
import type { Meeting, ModelState, SessionSource, SessionSourceProvider } from '../domain/types.ts';
import { transcribeAudioFile } from '../inference/file-transcription.ts';

export interface PickedMedia {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

function safeFilename(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || `media-${Date.now()}`;
}

function extensionFor(name: string, mimeType?: string): string {
  const match = name.match(/\.[a-zA-Z0-9]{1,8}$/);
  if (match) return match[0]!.toLocaleLowerCase();
  if (mimeType?.startsWith('video/')) return '.mp4';
  if (mimeType === 'audio/mpeg') return '.mp3';
  if (mimeType === 'audio/mp4') return '.m4a';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return '.wav';
  return '.media';
}

function providerForUrl(url: string): SessionSourceProvider {
  try {
    const host = new URL(url).hostname.toLocaleLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('drive.google.com')) return 'google_drive';
    if (host.includes('dropbox.com')) return 'dropbox';
    if (host.includes('sharepoint.com')) return 'sharepoint';
    if (host.includes('1drv.ms') || host.includes('onedrive.')) return 'onedrive';
    return 'direct_url';
  } catch {
    return 'unknown';
  }
}

function sessionsRoot(): string {
  if (!FileSystem.documentDirectory) throw new Error('Device document storage is unavailable.');
  return `${FileSystem.documentDirectory}roomtone/sessions/`;
}

export async function pickMediaDocument(): Promise<PickedMedia | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*', 'video/*'],
    copyToCacheDirectory: true,
    multiple: false
  });
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset) return undefined;
  return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? undefined, size: asset.size };
}

export async function stagePickedMedia(meetingId: string, picked: PickedMedia): Promise<SessionSource> {
  const directory = `${sessionsRoot()}${meetingId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = extensionFor(picked.name, picked.mimeType);
  const basename = safeFilename(picked.name.replace(/\.[a-zA-Z0-9]{1,8}$/, ''));
  const destination = `${directory}${basename}${extension}`;
  await FileSystem.copyAsync({ from: picked.uri, to: destination });
  return {
    kind: picked.mimeType?.startsWith('video/') ? 'video_upload' : 'audio_upload',
    provider: 'device',
    displayName: picked.name,
    uri: destination,
    originalUri: picked.uri,
    mimeType: picked.mimeType,
    sizeBytes: picked.size,
    importedAt: new Date().toISOString(),
    processingStatus: 'queued',
    progress: 0.08
  };
}

export async function stageRemoteMedia(meetingId: string, url: string, title?: string): Promise<SessionSource> {
  const trimmed = url.trim();
  if (!/^https?:\/\//iu.test(trimmed)) throw new Error('Enter a valid HTTPS audio or video URL.');
  const provider = providerForUrl(trimmed);
  if (provider === 'youtube') {
    throw new Error('YouTube page URLs are not direct media files. Export a file you are authorized to use, or choose it through the Android Files picker.');
  }
  const directory = `${sessionsRoot()}${meetingId}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const sourceName = safeFilename(title?.trim() || trimmed.split('/').pop() || `remote-${Date.now()}`);
  const extension = extensionFor(sourceName);
  const destination = `${directory}${sourceName.endsWith(extension) ? sourceName : `${sourceName}${extension}`}`;
  const download = await FileSystem.downloadAsync(trimmed, destination);
  return {
    kind: extension.match(/\.(?:mp4|mov|mkv|webm)$/iu) ? 'video_upload' : 'remote_url',
    provider,
    displayName: title?.trim() || sourceName,
    uri: download.uri,
    originalUri: trimmed,
    externalUrl: trimmed,
    importedAt: new Date().toISOString(),
    processingStatus: 'queued',
    progress: 0.08
  };
}

export async function processImportedSession(
  meeting: Meeting,
  model: ModelState,
  onUpdate: (meeting: Meeting) => Promise<void>
): Promise<Meeting> {
  if (!meeting.source?.uri) throw new Error('The imported session does not contain a local media file.');
  if (Platform.OS !== 'android' || !MediaNormalizer.isAvailable) {
    throw new Error('This application build does not include Android media normalization.');
  }

  const directory = `${sessionsRoot()}${meeting.id}/`;
  const normalizedUri = `${directory}normalized-16000-mono.wav`;
  let current = updateSource(meeting, { processingStatus: 'normalizing', progress: 0.18, error: undefined });
  current = { ...current, status: 'processing' };
  await onUpdate(current);

  try {
    const normalized = await MediaNormalizer.normalizeToWav(meeting.source.uri, normalizedUri);
    current = updateSource(current, {
      normalizedAudioUri: normalized.outputUri,
      processingStatus: 'transcribing',
      progress: 0.45
    });
    await onUpdate(current);

    const transcript = await transcribeAudioFile(current, model, normalized.outputUri, normalized.durationMs);
    current = replaceTranscript(current, transcript.speakers, transcript.segments);
    current = updateSource(current, { processingStatus: 'analyzing', progress: 0.88 });
    await onUpdate(current);

    current = finishMeeting(current, normalized.outputUri);
    current = {
      ...current,
      sourceLanguage: current.sourceLanguage === 'auto' ? transcript.detectedLanguage : current.sourceLanguage,
      source: current.source ? { ...current.source, processingStatus: 'complete', progress: 1, error: undefined } : current.source,
      metrics: { ...current.metrics, durationMs: normalized.durationMs },
      updatedAt: new Date().toISOString()
    };
    await onUpdate(current);
    return current;
  } catch (cause) {
    current = updateSource(current, {
      processingStatus: 'failed',
      error: cause instanceof Error ? cause.message : 'Media processing failed.'
    });
    current = { ...current, status: 'failed' };
    await onUpdate(current);
    throw cause;
  }
}
