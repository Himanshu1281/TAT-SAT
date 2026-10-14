import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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

const MOOD_META = [
  { key: 'calm', label: 'Calm', color: '#00BB84' },
  { key: 'happy', label: 'Happy', color: '#FFBA3D' },
  { key: 'grateful', label: 'Grateful', color: '#7861FF' },
  { key: 'reflective', label: 'Reflective', color: '#F79009' },
  { key: 'blessed', label: 'Blessed', color: '#98A2B3' },
];

export default function Stats() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>({ total_sessions: 0, total_minutes: 0, mantra_count: 0, streak: 0, points: 0, breakdown: { live: 0, meditation: 0, mantra: 0 }, live_attended: 0 });
  const [scope, setScope] = useState('national');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any>({ counts: { calm: 0, happy: 0, grateful: 0, reflective: 0, blessed: 0 } });
  const [monthly, setMonthly] = useState<any>({ series: [], totals: { calm: 0, happy: 0, grateful: 0, reflective: 0, blessed: 0 } });
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<'week' | 'month'>('week');

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
        const [s, w, m] = await Promise.all([
          api.get('/stats/me'),
          api.get('/mood/weekly-stats'),
          api.get('/mood/monthly-stats'),
        ]);
        setStats(s); setWeekly(w); setMonthly(m);
      } catch {}
    })();
  }, []);

  useEffect(() => { loadRank(scope); }, [scope, loadRank]);

  const weeklyCounts = weekly?.counts || {};
  const maxWeekly = Math.max(1, ...Object.values(weeklyCounts).map(Number));
  const monthSeries: any[] = monthly?.series || [];
  const maxMonthly = Math.max(1, ...monthSeries.map(d => Object.values(d.counts).reduce((a: number, b: any) => a + Number(b), 0)));

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
        {/* Points hero */}
        <View style={styles.pointsCard} testID="points-card">
          <LinearGradient colors={['#1A1A1A', '#3F3B33']} style={StyleSheet.absoluteFill as any} />
          <View style={styles.pointsHead}>
            <View>
              <Text style={styles.pointsLabel}>AATHMAN POINTS</Text>
              <Text style={styles.pointsValue}>{stats.points}</Text>
            </View>
            <View style={styles.pointsBadge}><Ionicons name="sparkles" size={16} color={colors.brand} /><Text style={styles.pointsBadgeText}>Level {Math.floor(stats.points / 500) + 1}</Text></View>
          </View>
          <View style={styles.breakdownRow}>
            <PointRow icon="videocam" label="Live sessions" value={`${stats.live_attended || 0} × 100`} points={stats.breakdown?.live || 0} />
            <PointRow icon="leaf" label="Meditation" value={`${stats.total_minutes} min → 50/hr`} points={stats.breakdown?.meditation || 0} />
            <PointRow icon="ellipse-outline" label="Mantra" value={`${stats.mantra_count} chants`} points={stats.breakdown?.mantra || 0} />
          </View>
          <Text style={styles.rules}>Rules: Live 100 pts · 50 pts / hr meditation · 50 pts / 108 malas</Text>
        </View>

        <View style={styles.statsCard}>
          <Row label="Total Sessions" value={String(stats.total_sessions)} />
          <Row label="Minutes of Meditation" value={String(stats.total_minutes)} />
          <Row label="Mantra Jaap Count" value={String(stats.mantra_count)} />
          <Row label="Spiritual Streak" value={`${stats.streak} days`} last />
        </View>

        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>Mood Graph</Text>
          <View style={styles.segment}>
            <Pressable testID="range-week" onPress={() => setRange('week')} style={[styles.segBtn, range === 'week' && styles.segActive]}>
              <Text style={[styles.segText, range === 'week' && styles.segTextActive]}>Week</Text>
            </Pressable>
            <Pressable testID="range-month" onPress={() => setRange('month')} style={[styles.segBtn, range === 'month' && styles.segActive]}>
              <Text style={[styles.segText, range === 'month' && styles.segTextActive]}>Month</Text>
            </Pressable>
          </View>
        </View>

        {range === 'week' ? (
          <View style={styles.moodCard} testID="mood-week-chart">
            {MOOD_META.map(m => {
              const v = Number(weeklyCounts[m.key] || 0);
              const pct = (v / maxWeekly) * 100;
              return (
                <View key={m.key} style={styles.barRow}>
                  <Text style={styles.barLabel}>{m.label}</Text>
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: m.color }]} /></View>
                  <Text style={styles.barVal}>{v}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.moodCard} testID="mood-month-chart">
            <View style={styles.monthChart}>
              {monthSeries.map((d, i) => {
                const t = Object.values(d.counts).reduce((a: number, b: any) => a + Number(b), 0) as number;
                const h = t === 0 ? 4 : Math.max(6, (t / maxMonthly) * 80);
                // Pick dominant mood color
                let dom = MOOD_META[0];
                let domVal = 0;
                for (const mm of MOOD_META) {
                  const v = Number(d.counts[mm.key] || 0);
                  if (v > domVal) { domVal = v; dom = mm; }
                }
                return (
                  <View key={d.date} style={styles.monthCol}>
                    <View style={[styles.monthBar, { height: h, backgroundColor: t === 0 ? colors.surfaceTertiary : dom.color }]} />
                    {i % 5 === 0 ? <Text style={styles.monthTick}>{d.date.slice(8)}</Text> : <Text style={styles.monthTick}> </Text>}
                  </View>
                );
              })}
            </View>
            <View style={styles.legendRow}>
              {MOOD_META.map(m => (
                <View key={m.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                  <Text style={styles.legendText}>{m.label} · {monthly.totals?.[m.key] || 0}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

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
            {leaderboard.length === 0 ? <Text style={styles.empty}>Be the first — earn points to appear here.</Text> : leaderboard.map((row: any) => (
              <View key={row.user_id} style={[styles.leaderRow, row.user_id === user?.id && styles.leaderRowMe]} testID={`rank-${row.rank}`}>
                <Text style={styles.rank}>#{row.rank}</Text>
                <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{(row.name || 'S')[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaderName}>{row.name} {row.user_id === user?.id ? '(You)' : ''}</Text>
                  <Text style={styles.leaderMeta}>{row.state || '—'} · {row.nationality || 'India'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.pts}>{row.points} pts</Text>
                  <Text style={styles.mins}>{row.mins}m</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PointRow({ icon, label, value, points }: { icon: any; label: string; value: string; points: number }) {
  return (
    <View style={pointRowStyles.row}>
      <View style={pointRowStyles.iconWrap}><Ionicons name={icon} size={14} color={colors.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={pointRowStyles.label}>{label}</Text>
        <Text style={pointRowStyles.value}>{value}</Text>
      </View>
      <Text style={pointRowStyles.pts}>+{points}</Text>
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

const pointRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  iconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,186,61,0.15)', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontSize: 13, fontWeight: '600' },
  value: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  pts: { fontFamily: fonts.display, color: colors.brand, fontSize: 18, fontWeight: '700' },
});

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
  pointsCard: { margin: spacing.lg, padding: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  pointsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pointsLabel: { color: colors.brand, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  pointsValue: { fontFamily: fonts.display, color: '#fff', fontSize: 42, fontWeight: '700', marginTop: 2 },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,186,61,0.2)', paddingHorizontal: 10, height: 30, borderRadius: 15 },
  pointsBadgeText: { color: colors.brand, fontSize: 11, fontWeight: '700' },
  breakdownRow: { marginTop: spacing.md, gap: 4 },
  rules: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 8 },
  statsCard: { marginHorizontal: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 3 },
  segBtn: { paddingHorizontal: 12, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.onSurface },
  segText: { color: colors.onSurface, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  moodCard: { marginHorizontal: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 80, color: colors.mutedStrong, fontSize: 12, fontWeight: '600' },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceTertiary, overflow: 'hidden' },
  barFill: { height: '100%' },
  barVal: { width: 24, textAlign: 'right', color: colors.onSurface, fontWeight: '700', fontSize: 12 },
  monthChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 100, marginTop: 4 },
  monthCol: { flex: 1, alignItems: 'center' },
  monthBar: { width: '100%', borderRadius: 3 },
  monthTick: { fontSize: 8, color: colors.muted, marginTop: 4 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.mutedStrong, fontSize: 11, fontWeight: '600' },
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
  pts: { color: colors.onSurface, fontWeight: '700', fontSize: 13 },
  mins: { color: colors.muted, fontWeight: '600', fontSize: 10, marginTop: 2 },
  empty: { color: colors.muted, padding: spacing.md, textAlign: 'center' },
});
