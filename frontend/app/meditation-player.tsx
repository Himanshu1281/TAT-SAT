import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const DURATIONS = [10, 30, 60, 120];
// Bell intervals in seconds
const BELLS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '30 min', value: 1800 },
  { label: '60 min', value: 3600 },
];

const VOLUMES = [0, 0.25, 0.5, 0.75, 1];

export default function MeditationPlayer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [med, setMed] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [trackIdx, setTrackIdx] = useState(0);
  const [duration, setDuration] = useState(10);
  const [bell, setBell] = useState(300);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const [muted, setMuted] = useState(false);
  const timerRef = useRef<any>(null);

  const currentTrack = tracks[trackIdx];
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Replace source when currentTrack changes
  useEffect(() => {
    if (!currentTrack?.url) return;
    try { player.replace({ uri: currentTrack.url }); } catch {}
    if (running) {
      try { player.play(); } catch {}
    }
  }, [currentTrack?.url, currentTrack?.id, player]);

  // Load meditation + music tracks
  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      } catch {}
      const [meds, music] = await Promise.all([api.get('/meditations'), api.get('/music')]);
      setTracks(music);
      if (id) {
        const m = meds.find((r: any) => r.id === id);
        if (m) {
          setMed(m);
          setDuration(m.duration_minutes);
          if (typeof m.bell_default === 'number') setBell(m.bell_default);
        }
      }
    })();
  }, [id]);

  // Loop track when it ends
  useEffect(() => {
    if (!status?.didJustFinish) return;
    try { player.seekTo(0); player.play(); } catch {}
  }, [status?.didJustFinish, player]);

  // Volume management
  useEffect(() => {
    try { player.volume = muted ? 0 : volume; } catch {}
  }, [player, volume, muted, currentTrack?.id]);

  // Timer
  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        if (bell > 0 && next > 0 && next % bell === 0 && next < duration * 60) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (next >= duration * 60) {
          clearInterval(timerRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setRunning(false);
          setCompleted(true);
          try { player.pause(); } catch {}
          finish(next);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, bell, duration, player]);

  const finish = async (secs: number) => {
    try {
      await api.post('/meditation/complete', {
        meditation_id: id || 'meditation',
        duration_minutes: Math.max(1, Math.round(secs / 60)),
      });
    } catch {}
  };

  const toggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (running) {
      try { player.pause(); } catch {}
      setRunning(false);
    } else {
      try { player.play(); } catch {}
      setRunning(true);
    }
  }, [running, player]);

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setCompleted(false);
    try { player.pause(); player.seekTo(0); } catch {}
  };

  const nextTrack = () => {
    if (!tracks.length) return;
    setTrackIdx(i => (i + 1) % tracks.length);
    if (running) setTimeout(() => { try { player.play(); } catch {} }, 200);
  };

  const prevTrack = () => {
    if (!tracks.length) return;
    setTrackIdx(i => (i - 1 + tracks.length) % tracks.length);
    if (running) setTimeout(() => { try { player.play(); } catch {} }, 200);
  };

  const cycleVolume = () => {
    const nextV = VOLUMES[(VOLUMES.indexOf(volume) + 1) % VOLUMES.length];
    setVolume(nextV);
    if (muted) setMuted(false);
  };

  const remain = duration * 60 - elapsed;
  const mm = Math.floor(remain / 60).toString().padStart(2, '0');
  const ss = (remain % 60).toString().padStart(2, '0');
  const percent = Math.min(100, (elapsed / (duration * 60)) * 100);

  const cover = med?.cover || currentTrack?.cover || 'https://images.pexels.com/photos/13849283/pexels-photo-13849283.jpeg';

  return (
    <View style={{ flex: 1, backgroundColor: '#101828' }} testID="meditation-player">
      <Image source={{ uri: cover }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
      <LinearGradient colors={['rgba(16,24,40,0.5)', 'rgba(16,24,40,0.96)']} style={StyleSheet.absoluteFill as any} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="close-player" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>{med?.title || 'Meditation'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.timerWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.timer}>{mm}:{ss}</Text>
          <Text style={styles.subtle}>Bell {bell === 0 ? 'off' : `every ${bell / 60} min`}</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {/* Music */}
          <View style={styles.musicCard} testID="music-card">
            <View style={styles.musicHead}>
              <Ionicons name="musical-notes" size={16} color={colors.brand} />
              <Text style={styles.musicLabel}>{currentTrack?.title || 'Music'}</Text>
            </View>
            <View style={styles.musicControls}>
              <Pressable testID="music-prev" onPress={prevTrack} style={styles.musicBtn}>
                <Ionicons name="play-skip-back" size={18} color="#fff" />
              </Pressable>
              <Pressable testID="music-toggle" onPress={toggle} style={styles.musicPlay}>
                <Ionicons name={running ? 'pause' : 'play'} size={20} color={colors.onBrand} />
              </Pressable>
              <Pressable testID="music-next" onPress={nextTrack} style={styles.musicBtn}>
                <Ionicons name="play-skip-forward" size={18} color="#fff" />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable testID="music-mute" onPress={() => setMuted(m => !m)} style={styles.musicBtn}>
                <Ionicons name={muted ? 'volume-mute' : 'volume-medium'} size={18} color="#fff" />
              </Pressable>
              <Pressable testID="music-vol" onPress={cycleVolume} style={styles.volPill}>
                <Text style={styles.volText}>{Math.round(volume * 100)}%</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {tracks.map((t, i) => (
                <Pressable key={t.id} testID={`track-${i}`} onPress={() => setTrackIdx(i)} style={[styles.trackChip, { flexShrink: 0 }, trackIdx === i && styles.trackChipActive]}>
                  <Text style={[styles.trackChipText, trackIdx === i && styles.trackChipTextActive]}>{t.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.label}>Duration</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {DURATIONS.map(d => (
              <Pressable key={d} testID={`dur-${d}`} onPress={() => !running && setDuration(d)} style={[styles.pill, { flexShrink: 0 }, duration === d && styles.pillActive]}>
                <Text style={[styles.pillText, duration === d && styles.pillTextActive]}>{d} min</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Bell Interval</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {BELLS.map(b => (
              <Pressable key={b.value} testID={`bell-${b.value}`} onPress={() => !running && setBell(b.value)} style={[styles.pill, { flexShrink: 0 }, bell === b.value && styles.pillActive]}>
                <Text style={[styles.pillText, bell === b.value && styles.pillTextActive]}>{b.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </ScrollView>

        <View style={styles.controls}>
          <Pressable testID="reset-btn" onPress={reset} style={styles.smallBtn}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </Pressable>
          <Pressable testID="play-btn" onPress={toggle} style={styles.playBtn}>
            <Ionicons name={running ? 'pause' : 'play'} size={28} color={colors.onBrand} />
          </Pressable>
          <View style={styles.smallBtn} />
        </View>
        {completed ? <Text style={styles.doneTxt} testID="session-done">🙏 Session complete. May peace be with you.</Text> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  timerWrap: { alignItems: 'center', marginTop: spacing.lg },
  progressBar: { width: '80%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brand },
  timer: { fontFamily: fonts.display, fontSize: 64, fontWeight: '300', color: '#fff', marginTop: spacing.md },
  subtle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  label: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  pill: { paddingHorizontal: 16, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: colors.onBrand },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingBottom: spacing.lg },
  smallBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  playBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  doneTxt: { color: colors.brand, textAlign: 'center', marginBottom: spacing.md, fontWeight: '600' },
  musicCard: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  musicHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  musicLabel: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },
  musicControls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm },
  musicBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  musicPlay: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  volPill: { paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  volText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  trackChip: { paddingHorizontal: 12, height: 30, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  trackChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  trackChipText: { color: '#fff', fontSize: 11 },
  trackChipTextActive: { color: colors.onBrand, fontWeight: '700' },
});
