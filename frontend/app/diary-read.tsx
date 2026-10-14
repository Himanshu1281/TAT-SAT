import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const MOOD_EMOJI: Record<string, string> = { happy: '😊', calm: '😌', grateful: '🙏', reflective: '🪔', blessed: '✨' };
const MOOD_LABEL: Record<string, string> = { happy: 'Happy', calm: 'Calm', grateful: 'Grateful', reflective: 'Reflective', blessed: 'Blessed' };

export default function DiaryRead() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try { setEntry(await api.get(`/diary/${id}`)); } finally { setLoading(false); }
    })();
  }, [id]);

  const remove = async () => {
    setDeleting(true);
    try {
      await api.del(`/diary/${id}`);
      router.back();
    } finally { setDeleting(false); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View>;
  if (!entry) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Text>Not found</Text></View>;

  const created = entry.created_at ? new Date(entry.created_at) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="diary-read-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="read-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="read-delete" onPress={remove} disabled={deleting} style={styles.iconBtn}>
            {deleting ? <ActivityIndicator size="small" color={colors.error} /> : <Ionicons name="trash-outline" size={18} color={colors.error} />}
          </Pressable>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={styles.dateWrap}>
          <Text style={styles.dateBig}>{entry.date}</Text>
          {created ? <Text style={styles.time}>{created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Text> : null}
        </View>
        {entry.mood ? (
          <View style={styles.moodChip}>
            <Text style={styles.moodEmoji}>{MOOD_EMOJI[entry.mood] || '📝'}</Text>
            <Text style={styles.moodLabel}>{MOOD_LABEL[entry.mood] || entry.mood}</Text>
          </View>
        ) : null}
        {entry.title ? <Text style={styles.title}>{entry.title}</Text> : null}
        <Text style={styles.body}>{entry.content}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  dateWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dateBig: { fontFamily: fonts.display, fontSize: 26, fontWeight: '700', color: colors.onSurface },
  time: { color: colors.muted, fontSize: 13 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceSecondary, alignSelf: 'flex-start', paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  moodEmoji: { fontSize: 18 },
  moodLabel: { color: colors.mutedStrong, fontWeight: '600', fontSize: 13 },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md, lineHeight: 36 },
  body: { color: colors.onSurface, fontSize: 16, marginTop: spacing.md, lineHeight: 26 },
});
