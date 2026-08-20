import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { palette, radius, spacing, type as typography } from '../theme/tokens.ts';
import { formatTimestamp } from '../utils/time.ts';

interface SessionPlayerProps {
  uri?: string;
  title: string;
  seekMs?: number;
  onPositionMs?(positionMs: number): void;
}

export function SessionPlayer({ uri, title, seekMs, onPositionMs }: SessionPlayerProps) {
  const player = useAudioPlayer(uri ? { uri } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [trackWidth, setTrackWidth] = useState(1);

  useEffect(() => {
    onPositionMs?.(Math.round(status.currentTime * 1000));
  }, [onPositionMs, status.currentTime]);

  useEffect(() => {
    if (seekMs === undefined || !status.isLoaded) return;
    void player.seekTo(Math.max(0, seekMs / 1000));
  }, [player, seekMs, status.isLoaded]);

  if (!uri) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableTitle}>Audio is not available</Text>
        <Text style={styles.unavailableText}>This session may still be processing, the audio may have expired under retention settings, or it may have been created from transcript-only content.</Text>
      </View>
    );
  }

  const duration = Math.max(0, status.duration || 0);
  const progress = duration ? Math.min(1, Math.max(0, status.currentTime / duration)) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) void player.seekTo(0);
    player.play();
  };

  const seekFromPress = (event: GestureResponderEvent) => {
    if (!duration) return;
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / trackWidth));
    void player.seekTo(duration * ratio);
  };

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{status.isBuffering ? 'Buffering local audio' : status.error ? status.error : 'Local synchronized playback'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause audio' : 'Play audio'} onPress={toggle} style={styles.playButton}>
          <Text style={styles.playText}>{status.playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="Audio playback position"
        onLayout={(event: LayoutChangeEvent) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
        onPress={seekFromPress}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTimestamp(status.currentTime * 1000)}</Text>
        <Text style={styles.time}>{formatTimestamp(duration * 1000)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, padding: spacing.md, margin: spacing.md, borderRadius: radius.lg, backgroundColor: palette.dark },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: spacing.xxs },
  title: { ...typography.bodyStrong, color: palette.onDark },
  meta: { ...typography.meta, color: palette.onDarkSubtle },
  playButton: { minWidth: 76, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round, backgroundColor: palette.surface },
  playText: { ...typography.meta, color: palette.ink, fontWeight: '700' },
  track: { height: 8, overflow: 'hidden', borderRadius: radius.round, backgroundColor: '#454545' },
  fill: { height: '100%', backgroundColor: palette.onDark },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { ...typography.mono, color: palette.onDarkSubtle },
  unavailable: { gap: spacing.xs, padding: spacing.md, margin: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface },
  unavailableTitle: { ...typography.bodyStrong, color: palette.ink },
  unavailableText: { ...typography.meta, color: palette.inkSubtle }
});
