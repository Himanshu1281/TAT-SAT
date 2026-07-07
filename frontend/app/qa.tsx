import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function QA() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get('/qa')); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const post = async () => {
    if (!q.trim()) return;
    setPosting(true);
    try {
      await api.post('/qa', { question: q.trim() });
      setQ(''); setPosted(true);
      setTimeout(() => setPosted(false), 2500);
    } finally { setPosting(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="qa-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="qa-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Q & A</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={
            <View style={styles.ask}>
              <Text style={styles.tag}>ASK GURUJI</Text>
              <TextInput
                testID="qa-input"
                value={q}
                onChangeText={setQ}
                placeholder="Ask a question about your spiritual practice…"
                placeholderTextColor={colors.muted}
                multiline
                style={styles.input}
                textAlignVertical="top"
              />
              <Pressable testID="qa-submit" onPress={post} disabled={posting || !q.trim()} style={[styles.cta, (posting || !q.trim()) && { opacity: 0.5 }]}>
                {posting ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.ctaText}>Submit</Text>}
              </Pressable>
              {posted ? <Text style={styles.posted} testID="qa-posted">✓ Sent to Guruji. Answers appear here weekly.</Text> : null}
              <Text style={styles.sectionHead}>Recent Answers</Text>
            </View>
          }
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.empty}>No answers yet — be the first to ask.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`qa-${item.id}`}>
              <Text style={styles.q}>Q. {item.question}</Text>
              <Text style={styles.by}>— {item.user_name}</Text>
              {item.answer ? <View style={styles.answerBox}><Text style={styles.answer}>{item.answer}</Text></View> : null}
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  title: { fontWeight: '700', color: colors.onSurface },
  ask: { gap: spacing.sm, paddingBottom: spacing.sm },
  tag: { color: colors.brandSecondary, fontWeight: '700', fontSize: 11, letterSpacing: 2 },
  input: { minHeight: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface },
  cta: { height: 48, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '700' },
  posted: { color: colors.success, textAlign: 'center', marginTop: 4, fontSize: 13 },
  sectionHead: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md },
  card: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  q: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.onSurface },
  by: { color: colors.muted, fontSize: 11, marginTop: 2 },
  answerBox: { marginTop: spacing.sm, padding: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.brand, backgroundColor: '#FFF6E1', borderRadius: 6 },
  answer: { color: colors.mutedStrong, lineHeight: 22 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
});
