import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const TABS: { key: 'music' | 'story' | 'counting_sheep'; label: string }[] = [
  { key: 'music', label: 'Music' },
  { key: 'story', label: 'Bedtime Stories' },
  { key: 'counting_sheep', label: 'Counting Sheep' },
];

export default function Sleep() {
  const router = useRouter();
  const [tab, setTab] = useState<'music' | 'story' | 'counting_sheep'>('music');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const rows = await api.get(`/sleep/content?kind=${tab}`);
      setItems(rows);
    })();
  }, [tab]);

  return (
    <View style={{ flex: 1, backgroundColor: '#101828' }} testID="sleep-screen">
      <LinearGradient colors={['#1E1A46', '#101828']} style={StyleSheet.absoluteFill as any} />
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="sleep-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Good Night 🌙</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.subtitleWrap}>
          <Text style={styles.subtitle}>Rest your mind. Let&apos;s find peace.</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map(t => (
            <Pressable key={t.key} testID={`sleep-tab-${t.key}`} onPress={() => setTab(t.key)} style={[styles.chip, { flexShrink: 0 }, tab === t.key && styles.chipActive]}>
              <Text style={[styles.chipText, tab === t.key && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`sleep-item-${item.id}`}>
            <Image source={{ uri: item.cover }} style={styles.img} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.duration_minutes} min</Text>
            </View>
            <View style={styles.playBtn}><Ionicons name="play" size={16} color={colors.onBrand} /></View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontWeight: '700', fontSize: 16 },
  subtitleWrap: { paddingHorizontal: spacing.lg },
  subtitle: { fontFamily: fonts.display, color: '#fff', fontSize: 26, fontWeight: '600' },
  tabsRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: '#fff', fontSize: 13 },
  chipTextActive: { color: colors.onBrand, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  img: { width: 60, height: 60, borderRadius: radius.md },
  itemTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  itemMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
