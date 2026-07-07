import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const DURATIONS = [5, 10, 15, 20, 30];
const BELLS = [0, 30, 60, 120, 300];

export default function MeditationPlayer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [med, setMed] = useState<any>(null);
  const [duration, setDuration] = useState(10);
  const [bell, setBell] = useState(60);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const rows = await api.get('/meditations');
      const m = rows.find((r: any) => r.id === id);
      if (m) {
        setMed(m);
        setDuration(m.duration_minutes);
        setBell(m.bell_default || 60);
      }
    })();
  }, [id]);

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
          finish(next);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running, bell, duration]);

  const finish = async (secs: number) => {
    try {
      await api.post('/meditation/complete', {
        meditation_id: id || 'freeform',
        duration_minutes: Math.max(1, Math.round(secs / 60)),
      });
    } catch {}
  };

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning(r => !r);
  };

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setCompleted(false);
  };

  const remain = duration * 60 - elapsed;
  const mm = Math.floor(remain / 60).toString().padStart(2, '0');
  const ss = (remain % 60).toString().padStart(2, '0');
  const percent = Math.min(100, (elapsed / (duration * 60)) * 100);

  const cover = med?.cover || 'https://images.pexels.com/photos/13849283/pexels-photo-13849283.jpeg';

  return (
    <View style={{ flex: 1, backgroundColor: '#101828' }} testID="meditation-player">
      <Image source={{ uri: cover }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
      <LinearGradient colors={['rgba(16,24,40,0.4)', 'rgba(16,24,40,0.95)']} style={StyleSheet.absoluteFill as any} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="close-player" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>{med?.title || 'Free Meditation'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.timerWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.timer}>{mm}:{ss}</Text>
          <Text style={styles.subtle}>Bell every {bell === 0 ? 'never' : `${bell}s`}</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={styles.label}>Duration (minutes)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {DURATIONS.map(d => (
              <Pressable key={d} testID={`dur-${d}`} onPress={() => !running && setDuration(d)} style={[styles.pill, { flexShrink: 0 }, duration === d && styles.pillActive]}>
                <Text style={[styles.pillText, duration === d && styles.pillTextActive]}>{d} min</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.label}>Bell interval</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {BELLS.map(b => (
              <Pressable key={b} testID={`bell-${b}`} onPress={() => !running && setBell(b)} style={[styles.pill, { flexShrink: 0 }, bell === b && styles.pillActive]}>
                <Text style={[styles.pillText, bell === b && styles.pillTextActive]}>{b === 0 ? 'Off' : `${b}s`}</Text>
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
  timerWrap: { alignItems: 'center', marginTop: spacing.xl },
  progressBar: { width: '80%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brand },
  timer: { fontFamily: fonts.display, fontSize: 72, fontWeight: '300', color: '#fff', marginTop: spacing.lg },
  subtle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  label: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 13 },
  pill: { paddingHorizontal: 16, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: colors.onBrand },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingBottom: spacing.lg },
  smallBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  playBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  doneTxt: { color: colors.brand, textAlign: 'center', marginBottom: spacing.md, fontWeight: '600' },
});
