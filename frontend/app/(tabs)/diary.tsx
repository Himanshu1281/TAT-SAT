import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const MOOD_EMOJI: Record<string, string> = { happy: '😊', calm: '😌', grateful: '🙏', reflective: '🪔', blessed: '✨' };
const CAL_DAYS = 30;

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function labelFor(dateStr: string): { day: string; wd: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: String(d.getDate()),
    wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
  };
}

export default function DiaryTab() {
  const router = useRouter();
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [datesWithEntries, setDatesWithEntries] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const calendarDays = useMemo(() => {
    const arr: string[] = [];
    const today = new Date();
    for (let i = CAL_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(formatDate(d));
    }
    return arr;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entries, dates] = await Promise.all([
        api.get('/diary'),
        api.get('/diary/dates'),
      ]);
      setAllEntries(entries);
      const map: Record<string, number> = {};
      for (const d of dates) map[d.date] = d.count;
      setDatesWithEntries(map);
    } catch {
      // e.g. signed out while this tab was mounted; keep the current list
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); setSelectedDate(null); }, [load]));

  const filtered = selectedDate ? allEntries.filter(e => e.date === selectedDate) : allEntries;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="diary-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.tag}>SPIRITUAL JOURNAL</Text>
            <Text style={styles.h1}>Dear Diary</Text>
          </View>
          <Pressable testID="add-entry-btn" onPress={() => router.push('/journal-entry')} style={styles.addBtn}>
            <Ionicons name="add" size={22} color={colors.onBrand} />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Calendar strip */}
      <View style={styles.calWrap}>
        <View style={styles.calHead}>
          <Text style={styles.calTitle}>Last 30 days</Text>
          {selectedDate ? (
            <Pressable testID="clear-date" onPress={() => setSelectedDate(null)} style={styles.clearBtn}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calRow}>
          {calendarDays.map(d => {
            const has = !!datesWithEntries[d];
            const isSel = selectedDate === d;
            const lbl = labelFor(d);
            const isToday = d === formatDate(new Date());
            return (
              <Pressable
                key={d}
                testID={`cal-day-${d}`}
                onPress={() => setSelectedDate(isSel ? null : d)}
                style={[styles.calDay, { flexShrink: 0 }, isSel && styles.calDayActive, isToday && !isSel && styles.calDayToday]}
              >
                <Text style={[styles.calWd, isSel && styles.calWdActive]}>{lbl.wd}</Text>
                <Text style={[styles.calDayNum, isSel && styles.calDayNumActive]}>{lbl.day}</Text>
                {has ? <View style={[styles.calDot, isSel && styles.calDotActive]} /> : <View style={styles.calDotEmpty} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.brand} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty} testID="diary-empty">
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>{selectedDate ? 'No entries on this day' : 'Begin your journey'}</Text>
          <Text style={styles.emptyBody}>Every reflection is a step towards awareness.</Text>
          <Pressable testID="empty-add-btn" onPress={() => router.push('/journal-entry')} style={styles.cta}>
            <Text style={styles.ctaText}>Write an entry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: spacing.sm, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              testID={`entry-${item.id}`}
              onPress={() => router.push({ pathname: '/diary-read', params: { id: item.id } })}
              style={styles.card}
            >
              <View style={styles.cardHead}>
                {item.mood ? <Text style={{ fontSize: 20 }}>{MOOD_EMOJI[item.mood] || '📝'}</Text> : <Text style={{ fontSize: 20 }}>📝</Text>}
                <Text style={styles.cardDate}>{item.date}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 'auto' }} />
              </View>
              {item.title ? <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text> : null}
              <Text numberOfLines={3} style={styles.cardBody}>{item.content}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  tag: { color: colors.muted, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  h1: { fontFamily: fonts.display, fontSize: 32, fontWeight: '700', color: colors.onSurface, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  calWrap: { paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  calHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4 },
  calTitle: { color: colors.mutedStrong, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  clearBtn: { paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 11, color: colors.mutedStrong, fontWeight: '700' },
  calRow: { gap: 6, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 4 },
  calDay: { width: 44, height: 60, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingVertical: 4 },
  calDayActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  calDayToday: { borderColor: colors.brand },
  calWd: { fontSize: 10, color: colors.muted, fontWeight: '700' },
  calWdActive: { color: 'rgba(255,255,255,0.6)' },
  calDayNum: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.onSurface, lineHeight: 22 },
  calDayNumActive: { color: '#fff' },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brand, marginTop: 2 },
  calDotActive: { backgroundColor: '#fff' },
  calDotEmpty: { width: 4, height: 4, marginTop: 2 },
  empty: { alignItems: 'center', padding: spacing.xl, marginTop: 40 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md },
  emptyBody: { color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
  cta: { marginTop: spacing.lg, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '700' },
  card: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDate: { color: colors.muted, fontSize: 12 },
  cardTitle: { color: colors.onSurface, fontSize: 15, fontWeight: '700', marginTop: 6 },
  cardBody: { color: colors.mutedStrong, fontSize: 13, marginTop: 4, lineHeight: 20 },
});
