import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Login() {
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { sendOtp } = useAuth();

  const submit = async () => {
    setError(null);
    if (!value.trim()) { setError('Please enter your ' + method); return; }
    setLoading(true);
    try {
      const identifier = method === 'phone' ? value.replace(/[^0-9+]/g, '') : value.trim().toLowerCase();
      const res: any = await sendOtp(identifier, method);
      router.push({ pathname: '/(auth)/verify', params: { identifier, method, dev_otp: res?.dev_otp || '' } });
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.back} onPress={() => router.back()} testID="login-back-btn">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={styles.body}>
            <Text style={styles.title}>Namaste</Text>
            <Text style={styles.subtitle}>Sign in to continue your{"\n"}spiritual journey</Text>

            <View style={styles.tabs}>
              <Pressable
                testID="method-email-tab"
                style={[styles.tab, method === 'email' && styles.tabActive]}
                onPress={() => setMethod('email')}
              >
                <Ionicons name="mail-outline" size={16} color={method === 'email' ? colors.onBrand : colors.onSurface} />
                <Text style={[styles.tabText, method === 'email' && styles.tabTextActive]}>Email</Text>
              </Pressable>
              <Pressable
                testID="method-phone-tab"
                style={[styles.tab, method === 'phone' && styles.tabActive]}
                onPress={() => setMethod('phone')}
              >
                <Ionicons name="call-outline" size={16} color={method === 'phone' ? colors.onBrand : colors.onSurface} />
                <Text style={[styles.tabText, method === 'phone' && styles.tabTextActive]}>Phone</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>{method === 'email' ? 'Email address' : 'Phone number'}</Text>
            <TextInput
              testID="login-identifier-input"
              style={styles.input}
              placeholder={method === 'email' ? 'you@example.com' : '+91 98765 43210'}
              placeholderTextColor={colors.muted}
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
            />
            {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

            <Pressable
              testID="login-submit-btn"
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85 }]}
            >
              {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.ctaText}>Send OTP</Text>}
            </Pressable>
            <Text style={styles.tos}>By continuing, you agree to Aathman&apos;s Terms &amp; Privacy Policy.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  back: { padding: spacing.md, marginLeft: spacing.xs, alignSelf: 'flex-start' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 40, fontWeight: '700', color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: spacing.sm, fontSize: 15, lineHeight: 22 },
  tabs: { flexDirection: 'row', marginTop: spacing.xl, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.brand },
  tabText: { fontWeight: '600', color: colors.onSurface },
  tabTextActive: { color: colors.onBrand },
  label: { marginTop: spacing.xl, color: colors.mutedStrong, fontSize: 13, fontWeight: '600' },
  input: { marginTop: spacing.sm, height: 56, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.onSurface },
  error: { color: colors.error, marginTop: spacing.sm, fontSize: 13 },
  cta: { marginTop: spacing.xl, height: 56, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '700', fontSize: 16 },
  tos: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: spacing.md },
});
