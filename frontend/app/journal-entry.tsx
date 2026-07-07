import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const MOODS = [
  { key: 'happy', emoji: '😊', label: 'Happy' },
  { key: 'calm', emoji: '😌', label: 'Calm' },
  { key: 'grateful', emoji: '🙏', label: 'Grateful' },
  { key: 'anxious', emoji: '😟', label: 'Anxious' },
  { key: 'sad', emoji: '😔', label: 'Sad' },
];

export default function JournalEntry() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await api.post('/diary', { title: title.trim(), content: content.trim(), mood });
      router.back();
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="journal-entry-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable testID="journal-cancel" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>New Entry</Text>
          <Pressable testID="journal-save" onPress={save} disabled={saving || !content.trim()} style={[styles.saveBtn, (!content.trim() || saving) && { opacity: 0.4 }]}>
            {saving ? <ActivityIndicator size="small" color={colors.onBrand} /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.label}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {MOODS.map(m => (
              <Pressable key={m.key} testID={`jmood-${m.key}`} onPress={() => setMood(m.key)} style={[styles.mood, mood === m.key && styles.moodActive]}>
                <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                <Text style={styles.moodLabel}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput testID="journal-title" value={title} onChangeText={setTitle} placeholder="Title (optional)" placeholderTextColor={colors.muted} style={styles.titleInput} />
          <TextInput
            testID="journal-content"
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="Write your reflection…"
            placeholderTextColor={colors.muted}
            style={styles.contentInput}
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '700', color: colors.onSurface },
  saveBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.onBrand, fontWeight: '700' },
  label: { color: colors.mutedStrong, fontWeight: '600', fontSize: 13 },
  moodRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  mood: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: 'transparent' },
  moodActive: { borderColor: colors.brand, backgroundColor: '#FFF6E1' },
  moodLabel: { fontSize: 10, color: colors.mutedStrong, marginTop: 2, fontWeight: '600' },
  titleInput: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md, paddingVertical: 4 },
  contentInput: { minHeight: 320, marginTop: spacing.md, color: colors.onSurface, fontSize: 15, lineHeight: 24 },
});
