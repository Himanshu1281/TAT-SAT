import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fonts, shadow } from '@/src/theme';

const MOODS: { key: string; label: string; emoji: string; color: string }[] = [
  { key: 'happy', label: 'Happy', emoji: '😊', color: '#FFE8B8' },
  { key: 'calm', label: 'Calm', emoji: '😌', color: '#D9F5E9' },
  { key: 'grateful', label: 'Grateful', emoji: '🙏', color: '#EEE9FF' },
  { key: 'anxious', label: 'Anxious', emoji: '😟', color: '#FEE4E2' },
  { key: 'sad', label: 'Sad', emoji: '😔', color: '#E5E7EB' },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [meditations, setMeditations] = useState<any[]>([]);
  const [guru, setGuru] = useState<any | null>(null);
  const [quote, setQuote] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savedMood, setSavedMood] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, g, q] = await Promise.all([
        api.get('/meditations'),
        api.get('/guru/messages'),
        api.get('/guru/quote-today'),
      ]);
      setMeditations(m);
      setGuru(g?.[0] || null);
      setQuote(q);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pickMood = async (m: string) => {
    Haptics.selectionAsync();
    setSavedMood(m);
    try { await api.post('/mood', { mood: m, kind: 'checkin' }); } catch {}
  };

  const first = (user?.name || 'Seeker').split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="home-screen">
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSm}>Namaste,</Text>
            <Text style={styles.greeting}>{first} 🪔</Text>
          </View>
          <Pressable testID="sos-fab" style={styles.sosBtn} onPress={() => router.push('/sos')}>
            <Ionicons name="alert-circle" size={16} color="#fff" />
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Mood check-in */}
        <View style={styles.moodCard} testID="mood-checkin-card">
          <Text style={styles.h3}>How do you feel today?</Text>
          <View style={styles.moodRow}>
            {MOODS.map(m => (
              <Pressable
                key={m.key}
                testID={`mood-${m.key}`}
                onPress={() => pickMood(m.key)}
                style={[styles.moodItem, { backgroundColor: m.color }, savedMood === m.key && styles.moodItemActive]}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={styles.moodLabel}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <QuickAction icon="timer-outline" label="Meditate" onPress={() => router.push('/meditation-player')} testID="qa-meditate" />
          <QuickAction icon="hand-left-outline" label="Mantra" onPress={() => router.push('/mantra')} testID="qa-mantra" />
          <QuickAction icon="moon-outline" label="Sleep" onPress={() => router.push('/sleep')} testID="qa-sleep" />
          <QuickAction icon="stats-chart-outline" label="Stats" onPress={() => router.push('/stats')} testID="qa-stats" />
        </View>

        {/* Daily recommendations */}
        <View style={styles.sectionHeader}>
          <Text style={styles.h2}>Daily Recommendations</Text>
          <Pressable onPress={() => router.push('/(tabs)/meditation')} testID="see-all-meditations">
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 4 }}>
          {meditations.slice(0, 6).map((m: any) => (
            <Pressable key={m.id} testID={`meditation-card-${m.id}`} onPress={() => router.push({ pathname: '/meditation-player', params: { id: m.id } })} style={styles.recCard}>
              <Image source={{ uri: m.cover }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(16,24,40,0.85)']} style={StyleSheet.absoluteFill as any} />
              <View style={styles.recCardBody}>
                <Text numberOfLines={2} style={styles.recTitle}>{m.title}</Text>
                <View style={styles.recMeta}>
                  <Ionicons name="time-outline" size={12} color="#fff" />
                  <Text style={styles.recMetaText}>{m.duration_minutes} min</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Message from Guru */}
        {guru ? (
          <Pressable onPress={() => router.push('/guru-messages')} testID="guru-message-card" style={styles.guruCard}>
            <Image source={{ uri: guru.cover }} style={styles.guruImg} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.guruTag}>Message from Guruji</Text>
              <Text numberOfLines={2} style={styles.guruTitle}>{guru.title}</Text>
              <Text numberOfLines={2} style={styles.guruBody}>{guru.body}</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Quote */}
        {quote ? (
          <View style={styles.quoteCard} testID="quote-of-day">
            <Text style={styles.quoteMark}>“</Text>
            <Text style={styles.quoteText}>{quote.text}</Text>
            <Text style={styles.quoteAuthor}>— {quote.author}</Text>
          </View>
        ) : null}

        {/* Explore row */}
        <View style={styles.sectionHeader}><Text style={styles.h2}>Explore</Text></View>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <ExploreCard icon="book" label="Books & Magazines" hint="Wisdom for conscious living" onPress={() => router.push('/books')} testID="explore-books" />
          <ExploreCard icon="videocam" label="Weekly Satsang" hint="Live with Guruji" onPress={() => router.push('/(tabs)/satsang')} testID="explore-satsang" />
          <ExploreCard icon="help-circle" label="Q & A" hint="Ask the Guru" onPress={() => router.push('/qa')} testID="explore-qa" />
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.qa}>
      <View style={styles.qaIcon}><Ionicons name={icon} size={22} color={colors.onSurface} /></View>
      <Text style={styles.qaLabel}>{label}</Text>
    </Pressable>
  );
}

function ExploreCard({ icon, label, hint, onPress, testID }: { icon: any; label: string; hint: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.explore}>
      <View style={styles.exploreIcon}><Ionicons name={icon} size={22} color={colors.brandSecondary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.exploreLabel}>{label}</Text>
        <Text style={styles.exploreHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  greetingSm: { color: colors.muted, fontSize: 13 },
  greeting: { fontFamily: fonts.display, fontSize: 28, color: colors.onSurface, fontWeight: '700' },
  sosBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.error, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  sosText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  moodCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  h3: { fontSize: 16, fontWeight: '600', color: colors.onSurface },
  h2: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  moodItem: { flex: 1, marginHorizontal: 3, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  moodItemActive: { borderColor: colors.brand },
  moodEmoji: { fontSize: 24 },
  moodLabel: { fontSize: 11, color: colors.mutedStrong, marginTop: 2, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: spacing.md },
  qa: { alignItems: 'center', flex: 1 },
  qaIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 12, marginTop: 6, color: colors.mutedStrong, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  seeAll: { color: colors.brandSecondary, fontWeight: '600', fontSize: 13 },
  recCard: { width: 180, height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  recCardBody: { flex: 1, justifyContent: 'flex-end', padding: spacing.md },
  recTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  recMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  recMetaText: { color: '#fff', fontSize: 12 },
  guruCard: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: '#101828', ...shadow.soft },
  guruImg: { width: 72, height: 72, borderRadius: radius.md },
  guruTag: { color: colors.brand, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  guruTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 },
  guruBody: { color: '#C7CCD9', fontSize: 12, marginTop: 4, lineHeight: 18 },
  quoteCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: '#FFF6E1', borderWidth: 1, borderColor: '#FFE8B8' },
  quoteMark: { fontFamily: fonts.display, fontSize: 48, color: colors.brand, lineHeight: 48, marginBottom: -8 },
  quoteText: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface, lineHeight: 28, fontStyle: 'italic' },
  quoteAuthor: { marginTop: spacing.sm, color: colors.mutedStrong, fontSize: 13, fontWeight: '600' },
  explore: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  exploreIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center' },
  exploreLabel: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  exploreHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
