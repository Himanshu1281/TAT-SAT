import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const KINDS = [
  { key: 'satsang', label: 'Weekly Satsang' },
  { key: 'yoga', label: 'Weekly Yoga' },
];

export default function SatsangTab() {
  const [kind, setKind] = useState<'satsang' | 'yoga'>('satsang');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async (k: string) => {
    setLoading(true);
    try { setSessions(await api.get(`/live/sessions?kind=${k}`)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(kind); }, [kind, load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="satsang-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.tag}>LIVE SESSIONS</Text>
          <Text style={styles.h1}>Sacred Gatherings</Text>
        </View>
        <View style={styles.tabs}>
          {KINDS.map(k => (
            <Pressable key={k.key} testID={`kind-${k.key}`} onPress={() => setKind(k.key as any)} style={[styles.tab, kind === k.key && styles.tabActive]}>
              <Text style={[styles.tabText, kind === k.key && styles.tabTextActive]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}>
          {sessions.map((s) => (
            <View key={s.id} style={styles.card} testID={`live-${s.id}`}>
              <View style={styles.imgWrap}>
                <Image source={{ uri: s.cover }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(16,24,40,0.85)']} style={StyleSheet.absoluteFill as any} />
                {s.is_live ? (
                  <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
                ) : null}
                <View style={styles.imgBody}>
                  <Text style={styles.host}>with {s.host}</Text>
                  <Text style={styles.title} numberOfLines={2}>{s.title}</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.desc} numberOfLines={2}>{s.description}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                    <Text style={styles.meta}>{new Date(s.start_at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
                <Pressable testID={`join-${s.id}`} style={styles.joinBtn} onPress={() => router.push({ pathname: '/live-player', params: { id: s.id, ytid: s.youtube_id, title: s.title } })}>
                  <Ionicons name="play" size={14} color={colors.onBrand} />
                  <Text style={styles.joinText}>{s.is_live ? 'Join Live' : 'Watch'}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  tag: { color: colors.muted, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  h1: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: colors.onSurface, marginTop: 2 },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  tab: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.onSurface },
  tabText: { fontWeight: '600', color: colors.onSurface, fontSize: 13 },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  imgWrap: { height: 180, position: 'relative', backgroundColor: '#000' },
  imgBody: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md },
  host: { color: colors.brand, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  liveBadge: { position: 'absolute', top: spacing.md, left: spacing.md, backgroundColor: colors.error, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontWeight: '700', fontSize: 10, letterSpacing: 1 },
  cardFooter: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center' },
  desc: { color: colors.mutedStrong, fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { fontSize: 11, color: colors.muted },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brand, paddingHorizontal: 14, height: 40, borderRadius: radius.pill },
  joinText: { color: colors.onBrand, fontWeight: '700', fontSize: 13 },
});
