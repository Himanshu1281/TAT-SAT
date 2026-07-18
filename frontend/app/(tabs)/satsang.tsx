import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native';
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

const AATHMAN_STREAMS_URL = 'https://www.youtube.com/@Aathmanawarenesscentre/streams';

export default function SatsangTab() {
  const [kind, setKind] = useState<'satsang' | 'yoga'>('satsang');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);
  const router = useRouter();

  const load = useCallback(async (k: string) => {
    setLoading(true);
    try {
      const [rows, ch, cur] = await Promise.all([
        api.get(`/live/sessions?kind=${k}`),
        api.get('/live/aathman-channel'),
        api.get('/live/aathman-current').catch(() => null),
      ]);
      setSessions(rows);
      setChannel(ch);
      setCurrent(cur);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(kind); }, [kind, load]);

  const openLive = async (s: any) => {
    try { await api.post('/live/attend', { session_id: s.id }); } catch {}
    router.push({
      pathname: '/live-player',
      params: {
        title: s.title,
        channel: s.youtube_channel_id || channel?.channel_id,
        ytid: current?.video_id || s.youtube_id || '',
      },
    });
  };

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
          <View style={styles.channelCard} testID="aathman-channel-card">
            <View style={styles.channelIcon}>
              <Ionicons name="logo-youtube" size={22} color="#FF0033" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.channelTitle}>Aathman YouTube</Text>
                {current?.is_live_now ? (
                  <View style={styles.liveDotSm}><View style={styles.liveDotSmInner} /><Text style={styles.liveDotSmText}>LIVE</Text></View>
                ) : null}
              </View>
              <Text style={styles.channelSub} numberOfLines={2}>
                {current?.is_live_now
                  ? `${current.title || 'Guruji is live now'} · watch + chat`
                  : 'All satsangs & yoga stream here — watch live with chat'}
              </Text>
            </View>
            <Pressable
              testID="watch-live-btn"
              onPress={() => channel?.channel_id && router.push({ pathname: '/live-player', params: { channel: channel.channel_id, ytid: current?.video_id || '', title: current?.title || 'Aathman Live' } })}
              style={styles.channelBtn}
            >
              <Ionicons name="play" size={14} color={colors.onBrand} />
              <Text style={styles.channelBtnText}>{current?.is_live_now ? 'Join Live' : 'Watch'}</Text>
            </Pressable>
          </View>

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
                <Pressable testID={`join-${s.id}`} style={styles.joinBtn} onPress={() => openLive(s)}>
                  <Ionicons name="play" size={14} color={colors.onBrand} />
                  <Text style={styles.joinText}>{s.is_live ? 'Join Live' : 'Watch'}</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            testID="all-streams-btn"
            onPress={() => Linking.openURL(AATHMAN_STREAMS_URL)}
            style={styles.allStreamsBtn}
          >
            <Ionicons name="logo-youtube" size={16} color={colors.onSurface} />
            <Text style={styles.allStreamsText}>See all past streams</Text>
            <Ionicons name="open-outline" size={14} color={colors.muted} />
          </Pressable>
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
  channelCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  channelIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF6E1', alignItems: 'center', justifyContent: 'center' },
  channelTitle: { fontWeight: '700', color: colors.onSurface, fontSize: 14 },
  channelSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  channelBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: colors.brand, paddingHorizontal: 12, height: 36, borderRadius: radius.pill },
  channelBtnText: { color: colors.onBrand, fontWeight: '700', fontSize: 12 },
  liveDotSm: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.error, paddingHorizontal: 6, height: 16, borderRadius: 8 },
  liveDotSmInner: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  liveDotSmText: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
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
  allStreamsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.sm, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  allStreamsText: { color: colors.onSurface, fontWeight: '700', fontSize: 13 },
});
