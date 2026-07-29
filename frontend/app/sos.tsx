import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fonts } from '@/src/theme';

const FEELINGS = ['Overwhelmed', 'Depressed', 'Anxious', 'Lonely', 'Suicidal thoughts', 'Other'];

export default function SOS() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !feeling) return;
    setSubmitting(true);
    try {
      const res = await api.post('/sos/request', { name, phone, feeling, note });
      setDone(res?.message || 'Our teacher will call you soon.');
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <View style={styles.container} testID="sos-done">
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable testID="sos-close" onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.doneWrap}>
            <View style={styles.doneCircle}><Ionicons name="checkmark" size={40} color="#fff" /></View>
            <Text style={styles.doneTitle}>You reached out.{"\n"}That was brave.</Text>
            <Text style={styles.doneBody}>{done}</Text>
            <Pressable testID="sos-back-home" onPress={() => router.replace('/(tabs)')} style={styles.homeBtn}>
              <Text style={styles.homeText}>Back to Home</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="sos-screen">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="sos-close" onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.tag}>SOS · YOU ARE NOT ALONE</Text>
            <Text style={styles.title}>Talk to a teacher</Text>
            <Text style={styles.subtitle}>Share how you feel. A trained Aathman teacher will reach out shortly.</Text>

            <Text style={styles.label}>Your name</Text>
            <TextInput testID="sos-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.input} />

            <Text style={styles.label}>Phone number</Text>
            <TextInput testID="sos-phone" value={phone} onChangeText={setPhone} placeholder="+91 …" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} />

            <Text style={styles.label}>What best describes how you feel?</Text>
            <View style={styles.chipsWrap}>
              {FEELINGS.map(f => (
                <Pressable key={f} testID={`feeling-${f}`} onPress={() => setFeeling(f)} style={[styles.chip, feeling === f && styles.chipActive]}>
                  <Text style={[styles.chipText, feeling === f && styles.chipTextActive]}>{f}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Anything else? (optional)</Text>
            <TextInput testID="sos-note" value={note} onChangeText={setNote} multiline placeholder="You can share more…" placeholderTextColor={colors.muted} style={[styles.input, { height: 100, paddingTop: 12 }]} textAlignVertical="top" />

            <Pressable testID="sos-submit" onPress={submit} disabled={submitting || !name || !phone || !feeling} style={[styles.cta, (submitting || !name || !phone || !feeling) && { opacity: 0.5 }]}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Request Counselling</Text>}
            </Pressable>
            <Text style={styles.helper}>Disclaimer — SOS is a support request by choice, not an emergency service. If you are at immediate risk of harming yourself or others, please contact emergency services (112) or visit the nearest hospital immediately.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tag: { color: colors.error, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: '700', color: colors.onSurface, marginTop: 4 },
  subtitle: { color: colors.mutedStrong, marginTop: spacing.sm, lineHeight: 20 },
  label: { marginTop: spacing.lg, color: colors.mutedStrong, fontSize: 13, fontWeight: '600' },
  input: { marginTop: spacing.sm, minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15, color: colors.onSurface },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.error, borderColor: colors.error },
  chipText: { color: colors.onSurface, fontSize: 12 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  cta: { marginTop: spacing.xl, height: 54, backgroundColor: colors.error, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  helper: { marginTop: spacing.md, textAlign: 'center', color: colors.muted, fontSize: 12 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  doneCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.display, fontSize: 28, fontWeight: '700', color: colors.onSurface, marginTop: spacing.lg, textAlign: 'center' },
  doneBody: { color: colors.mutedStrong, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  homeBtn: { marginTop: spacing.xl, backgroundColor: colors.brand, paddingHorizontal: spacing.xl, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  homeText: { color: colors.onBrand, fontWeight: '700' },
});
