import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const MOOD_EMOJI: Record<string, string> = { happy: '😊', calm: '😌', grateful: '🙏', anxious: '😟', sad: '😔' };

export default function DiaryTab() {
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await api.get('/diary')); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

      {loading ? (
        <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.brand} /></View>
      ) : entries.length === 0 ? (
        <View style={styles.empty} testID="diary-empty">
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>Begin your journey</Text>
          <Text style={styles.emptyBody}>Every reflection is a step towards awareness.</Text>
          <Pressable testID="empty-add-btn" onPress={() => router.push('/journal-entry')} style={styles.cta}>
            <Text style={styles.ctaText}>Write your first entry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`entry-${item.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {item.mood ? <Text style={{ fontSize: 20 }}>{MOOD_EMOJI[item.mood] || '📝'}</Text> : null}
                <Text style={styles.cardDate}>{item.date}</Text>
              </View>
              {item.title ? <Text style={styles.cardTitle}>{item.title}</Text> : null}
              <Text numberOfLines={3} style={styles.cardBody}>{item.content}</Text>
            </View>
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
  empty: { alignItems: 'center', padding: spacing.xl, marginTop: 60 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md },
  emptyBody: { color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
  cta: { marginTop: spacing.lg, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '700' },
  card: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  cardDate: { color: colors.muted, fontSize: 12 },
  cardTitle: { color: colors.onSurface, fontSize: 15, fontWeight: '700', marginTop: 6 },
  cardBody: { color: colors.mutedStrong, fontSize: 13, marginTop: 4, lineHeight: 20 },
});
