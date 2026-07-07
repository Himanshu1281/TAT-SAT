import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fonts } from '@/src/theme';

const SCOPES = [
  { key: 'circle', label: 'My Circle' },
  { key: 'state', label: 'State' },
  { key: 'national', label: 'National' },
  { key: 'international', label: 'International' },
];

export default function Stats() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>({ total_sessions: 0, total_minutes: 0, mantra_count: 0, streak: 0 });
  const [scope, setScope] = useState('national');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any>({ counts: { calm: 0, happy: 0, grateful: 0, anxious: 0, sad: 0 } });
  const [loading, setLoading] = useState(false);

  const loadRank = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const r = await api.get(`/rank?scope=${s}`);
      setLeaderboard(r.leaderboard || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, w] = await Promise.all([api.get('/stats/me'), api.get('/mood/weekly-stats')]);
        setStats(s); setWeekly(w);
      } catch {}
    })();
  }, []);

  useEffect(() => { loadRank(scope); }, [scope, loadRank]);

  const maxMood = Math.max(1, ...Object.values(weekly.counts || {}).map(Number));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="stats-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="stats-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.h1}>My Stats & Rank</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.statsCard}>
          <Row label="Total Sessions" value={String(stats.total_sessions)} />
          <Row label="Minutes of Meditation" value={String(stats.total_minutes)} />
          <Row label="Mantra Jaap Count" value={String(stats.mantra_count)} />
          <Row label="Spiritual Streak" value={`${stats.streak} days`} last />
        </View>

        <Text style={styles.sectionTitle}>Weekly Mood</Text>
        <View style={styles.moodCard}>
          {['calm', 'happy', 'grateful', 'anxious', 'sad'].map((m) => {
            const v = Number((weekly.counts as any)[m] || 0);
            const pct = (v / maxMood) * 100;
            return (
              <View key={m} style={styles.barRow}>
                <Text style={styles.barLabel}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>
                <Text style={styles.barVal}>{v}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Leaderboard</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SCOPES.map(s => (
            <Pressable key={s.key} testID={`scope-${s.key}`} onPress={() => setScope(s.key)} style={[styles.chip, { flexShrink: 0 }, scope === s.key && styles.chipActive]}>
              <Text style={[styles.chipText, scope === s.key && styles.chipTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} /> : (
          <View style={styles.leaderCard}>
            {leaderboard.length === 0 ? <Text style={styles.empty}>Be the first — meditate to appear here.</Text> : leaderboard.map((row: any) => (
              <View key={row.user_id} style={[styles.leaderRow, row.user_id === user?.id && styles.leaderRowMe]} testID={`rank-${row.rank}`}>
                <Text style={styles.rank}>#{row.rank}</Text>
                <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{(row.name || 'S')[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaderName}>{row.name} {row.user_id === user?.id ? '(You)' : ''}</Text>
                  <Text style={styles.leaderMeta}>{row.state || '—'} · {row.nationality || 'India'}</Text>
                </View>
                <Text style={styles.mins}>{row.mins}m</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[localRow.row, !last && localRow.border]}>
      <Text style={localRow.label}>{label}</Text>
      <Text style={localRow.value}>{value}</Text>
    </View>
  );
}

const localRow = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, alignItems: 'center' },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.mutedStrong, fontSize: 14, fontWeight: '500' },
  value: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, fontWeight: '700' },
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  h1: { fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.onSurface },
  statsCard: { margin: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface, marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  moodCard: { marginHorizontal: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 80, color: colors.mutedStrong, fontSize: 12, fontWeight: '600' },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceTertiary, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.brandSecondary },
  barVal: { width: 24, textAlign: 'right', color: colors.onSurface, fontWeight: '700', fontSize: 12 },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  chipText: { color: colors.onSurface, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  leaderCard: { marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  leaderRowMe: { backgroundColor: '#FFF6E1' },
  rank: { width: 32, fontFamily: fonts.display, fontSize: 18, color: colors.brand, fontWeight: '700' },
  smallAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandSecondary, alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { color: '#fff', fontWeight: '700' },
  leaderName: { color: colors.onSurface, fontWeight: '600', fontSize: 14 },
  leaderMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  mins: { color: colors.onSurface, fontWeight: '700' },
  empty: { color: colors.muted, padding: spacing.md, textAlign: 'center' },
});
