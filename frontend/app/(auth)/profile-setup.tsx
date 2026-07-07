import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fonts } from '@/src/theme';

const STATES = ['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','Uttarakhand','West Bengal','Other'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export default function ProfileSetup() {
  const { updateProfile, user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [nationality, setNationality] = useState('India');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateProfile({
        name: name.trim(),
        age: age ? parseInt(age, 10) : null,
        gender,
        sex: gender,
        state,
        nationality,
      });
      router.replace('/(tabs)');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="profile-setup-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.body}>
            <Text style={styles.title}>Tell us{"\n"}about yourself</Text>
            <Text style={styles.subtitle}>Help us personalise your practice.</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput testID="profile-name-input" value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} style={styles.input} />

            <Text style={styles.label}>Age</Text>
            <TextInput testID="profile-age-input" value={age} onChangeText={setAge} placeholder="e.g. 28" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipsWrap}>
              {GENDERS.map(g => (
                <Pressable key={g} testID={`gender-${g}`} onPress={() => setGender(g)} style={[styles.chip, gender === g && styles.chipActive]}>
                  <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>State</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}>
              {STATES.map(s => (
                <Pressable key={s} testID={`state-${s}`} onPress={() => setState(s)} style={[styles.chip, { flexShrink: 0 }, state === s && styles.chipActive]}>
                  <Text style={[styles.chipText, state === s && styles.chipTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Nationality</Text>
            <TextInput testID="profile-nationality-input" value={nationality} onChangeText={setNationality} style={styles.input} />

            <Pressable testID="profile-submit-btn" disabled={loading || !name.trim()} onPress={submit} style={({ pressed }) => [styles.cta, (pressed || loading || !name.trim()) && { opacity: 0.7 }]}>
              {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.ctaText}>Continue</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 36, fontWeight: '700', color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: spacing.sm, fontSize: 14 },
  label: { marginTop: spacing.lg, color: colors.mutedStrong, fontSize: 13, fontWeight: '600' },
  input: { marginTop: spacing.sm, height: 52, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.onSurface },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurface, fontSize: 13 },
  chipTextActive: { color: colors.onBrand, fontWeight: '700' },
  cta: { marginTop: spacing.xl, height: 56, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '700', fontSize: 16 },
});
