import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const CATS = ['All', 'Sleep', 'Peace', 'Focus'];

export default function MeditationTab() {
  const router = useRouter();
  const [cat, setCat] = useState('All');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (c: string) => {
    setLoading(true);
    try {
      const q = c === 'All' ? '' : `?category=${c.toLowerCase()}`;
      const rows = await api.get('/meditations' + q);
      setItems(rows);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(cat); }, [cat, load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="meditation-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.h1}>Meditation</Text>
          <Pressable testID="open-timer" onPress={() => router.push('/meditation-player')} style={styles.hIcon}>
            <Ionicons name="timer-outline" size={20} color={colors.onSurface} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATS.map(c => (
            <Pressable key={c} testID={`cat-${c}`} onPress={() => setCat(c)} style={[styles.chip, { flexShrink: 0 }, cat === c && styles.chipActive]}>
              <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>

      {loading ? (
        <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: 40, paddingTop: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable testID={`med-${item.id}`} style={styles.card} onPress={() => router.push({ pathname: '/meditation-player', params: { id: item.id } })}>
              <Image source={{ uri: item.cover }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(16,24,40,0.85)']} style={StyleSheet.absoluteFill as any} />
              <View style={styles.cardBody}>
                <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.rowMeta}>
                  <Ionicons name="time-outline" size={12} color="#fff" />
                  <Text style={styles.meta}>{item.duration_minutes} min</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  h1: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: colors.onSurface },
  hIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  chipText: { color: colors.onSurface, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  card: { flex: 1, height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  cardBody: { flex: 1, justifyContent: 'flex-end', padding: spacing.md },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { color: '#fff', fontSize: 12 },
});
