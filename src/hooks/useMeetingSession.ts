import { useCallback, useEffect, useRef, useState } from 'react';
import { addBookmark as addMeetingBookmark, addFinalSegment, createMeeting, finishMeeting, renameSpeaker as renameMeetingSpeaker } from '../domain/meeting.ts';
import type { Meeting, MeetingDraft, ModelState, Speaker, TranscriptSegment } from '../domain/types.ts';
import { appendMeetingEvent, saveMeeting } from '../infrastructure/meeting-repository.ts';
import { createMeetingRuntime } from '../inference/runtime-factory.ts';
import type { PcmAudioStream } from '../inference/expo-audio-stream-adapter.ts';
import type { MeetingRuntime, RuntimeSpeaker, RuntimeStatus } from '../inference/types.ts';

interface StartModels { speech?: ModelState; vad?: ModelState }

export function useMeetingSession(onPersisted: (meeting: Meeting) => void, audioStream: PcmAudioStream) {
  const [meeting, setMeeting] = useState<Meeting>();
  const [partialSegment, setPartialSegment] = useState<TranscriptSegment>();
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('idle');
  const [runtimeDetail, setRuntimeDetail] = useState<string>();
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string>();
  const meetingRef = useRef<Meeting>();
  const runtimeRef = useRef<MeetingRuntime>();
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: Meeting, event?: Parameters<typeof appendMeetingEvent>[1]) => {
    meetingRef.current = next;
    setMeeting(next);
    onPersisted(next);
    persistChainRef.current = persistChainRef.current.then(async () => {
      await saveMeeting(next);
      if (event) await appendMeetingEvent(next.id, event);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not save the meeting.'));
  }, [onPersisted]);

  const handleSpeaker = useCallback((incoming: RuntimeSpeaker) => {
    const current = meetingRef.current;
    if (!current || current.speakers.some((speaker) => speaker.id === incoming.id)) return;
    const speaker: Speaker = {
      id: incoming.id,
      meetingId: current.id,
      displayName: incoming.displayName ?? `Speaker ${current.speakers.length + 1}`,
      isNamed: incoming.isNamed ?? false,
      isEnrolled: false,
      createdAt: new Date().toISOString()
    };
    const next = { ...current, speakers: [...current.speakers, speaker], updatedAt: new Date().toISOString() };
    commit(next, { type: 'speaker.created', occurredAt: new Date().toISOString(), speaker });
  }, [commit]);

  const start = useCallback(async (draft: MeetingDraft, models: StartModels = {}): Promise<Meeting> => {
    setError(undefined);
    setPartialSegment(undefined);
    setAudioLevel(0);
    const initial = { ...createMeeting(draft), status: 'recording' as const };
    meetingRef.current = initial;
    setMeeting(initial);
    onPersisted(initial);
    await saveMeeting(initial);
    await appendMeetingEvent(initial.id, { type: 'meeting.started', occurredAt: initial.startedAt });
    const runtime = createMeetingRuntime(draft.runtime);
    runtimeRef.current = runtime;
    try {
      await runtime.start({
        meeting: initial,
        speechModel: models.speech,
        vadModel: models.vad,
        audioStream,
        callbacks: {
          onStatus: (status, detail) => { setRuntimeStatus(status); setRuntimeDetail(detail); },
          onSpeaker: handleSpeaker,
          onPartial: (segment) => setPartialSegment(segment),
          onFinal: (segment) => {
            const current = meetingRef.current;
            if (!current) return;
            const next = addFinalSegment(current, segment);
            setPartialSegment((partial) => partial?.id === segment.id ? undefined : partial);
            commit(next, { type: current.segments.some((item) => item.id === segment.id) ? 'transcript.segmentCorrected' : 'transcript.segmentFinalized', occurredAt: new Date().toISOString(), segment });
          },
          onAudioLevel: setAudioLevel,
          onError: (cause) => { setError(cause.message); setRuntimeStatus('error'); }
        }
      });
      return initial;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to start the meeting runtime.';
      setError(message);
      setRuntimeStatus('error');
      const failed = finishMeeting(initial);
      commit(failed);
      throw cause;
    }
  }, [audioStream, commit, handleSpeaker, onPersisted]);

  const stop = useCallback(async (): Promise<Meeting | undefined> => {
    const current = meetingRef.current;
    if (!current) return undefined;
    setRuntimeStatus('processing');
    try {
      const result = await runtimeRef.current?.stop();
      const completed = finishMeeting(meetingRef.current ?? current, result?.audioUri);
      commit(completed, { type: 'meeting.stopped', occurredAt: completed.endedAt ?? new Date().toISOString(), audioUri: result?.audioUri });
      await persistChainRef.current;
      setPartialSegment(undefined);
      setAudioLevel(0);
      setRuntimeStatus('stopped');
      return completed;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to stop the meeting cleanly.';
      setError(message);
      const completed = finishMeeting(meetingRef.current ?? current);
      commit(completed);
      return completed;
    }
  }, [commit]);

  const addBookmark = useCallback((note?: string) => {
    const current = meetingRef.current;
    if (!current) return;
    const latestTranscript = current.segments.reduce((latest, segment) => Math.max(latest, segment.endMs), 0);
    const elapsed = Date.now() - new Date(current.startedAt).getTime();
    const next = addMeetingBookmark(current, Math.max(latestTranscript, elapsed), note);
    const bookmark = next.bookmarks[next.bookmarks.length - 1];
    commit(next, bookmark ? { type: 'bookmark.created', occurredAt: bookmark.createdAt, bookmark } : undefined);
  }, [commit]);

  const renameSpeaker = useCallback((speakerId: string, displayName: string) => {
    const current = meetingRef.current;
    if (!current) return;
    const next = renameMeetingSpeaker(current, speakerId, displayName);
    commit(next, { type: 'speaker.renamed', occurredAt: new Date().toISOString(), speakerId, displayName });
  }, [commit]);

  const clear = useCallback(async () => {
    await runtimeRef.current?.release();
    runtimeRef.current = undefined;
    meetingRef.current = undefined;
    setMeeting(undefined);
    setPartialSegment(undefined);
    setRuntimeStatus('idle');
    setRuntimeDetail(undefined);
    setAudioLevel(0);
    setError(undefined);
  }, []);

  useEffect(() => () => { void runtimeRef.current?.release(); }, []);

  return { meeting, partialSegment, runtimeStatus, runtimeDetail, audioLevel, error, start, stop, addBookmark, renameSpeaker, clear };
}
