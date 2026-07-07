import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Verify() {
  const { identifier, method, dev_otp } = useLocalSearchParams<{ identifier: string; method: string; dev_otp?: string }>();
  const { verifyOtp, sendOtp } = useAuth();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(dev_otp || null);
  const refs = useRef<Array<TextInput | null>>([]);
  const router = useRouter();

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const onChange = (idx: number, val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    const next = [...digits];
    if (clean.length > 1) {
      // paste
      const arr = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) next[i] = arr[i] || '';
      setDigits(next);
      refs.current[Math.min(arr.length, 5)]?.focus();
      return;
    }
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < 5) refs.current[idx + 1]?.focus();
  };

  const onKey = (idx: number, key: string) => {
    if (key === 'Backspace' && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus();
  };

  const submit = async () => {
    setError(null);
    const otp = digits.join('');
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const { is_new } = await verifyOtp(String(identifier), otp, (method as any) || 'email');
      if (is_new) router.replace('/(auth)/profile-setup');
      else router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    setResending(true);
    try {
      const res: any = await sendOtp(String(identifier), (method as any) || 'email');
      setSeconds(30);
      setDevHint(res?.dev_otp || null);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="verify-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.back} onPress={() => router.back()} testID="verify-back-btn">
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={styles.body}>
            <Text style={styles.title}>Verify code</Text>
            <Text style={styles.subtitle}>We sent a 6-digit code to{"\n"}<Text style={{ color: colors.onSurface, fontWeight: '600' }}>{String(identifier)}</Text></Text>

            {devHint ? (
              <View style={styles.devHint} testID="dev-otp-hint">
                <Ionicons name="information-circle-outline" size={16} color={colors.brandSecondary} />
                <Text style={styles.devHintText}>Dev OTP: {devHint}</Text>
              </View>
            ) : null}

            <View style={styles.otpRow}>
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { refs.current[i] = r; }}
                  testID={`otp-digit-${i}`}
                  style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
                  value={d}
                  onChangeText={(v) => onChange(i, v)}
                  onKeyPress={({ nativeEvent }) => onKey(i, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                />
              ))}
            </View>

            {error ? <Text style={styles.error} testID="verify-error">{error}</Text> : null}

            <Pressable
              testID="verify-submit-btn"
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85 }]}
            >
              {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.ctaText}>Verify & Continue</Text>}
            </Pressable>

            <Pressable onPress={resend} disabled={seconds > 0 || resending} testID="verify-resend-btn" style={styles.resend}>
              <Text style={styles.resendText}>
                {seconds > 0 ? `Resend in ${seconds}s` : (resending ? 'Sending…' : 'Resend code')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  back: { padding: spacing.md, marginLeft: spacing.xs, alignSelf: 'flex-start' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 40, fontWeight: '700', color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: spacing.sm, fontSize: 15, lineHeight: 22 },
  devHint: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: spacing.md, padding: spacing.sm, backgroundColor: '#EEE9FF', borderRadius: radius.sm, alignSelf: 'flex-start' },
  devHintText: { color: colors.brandSecondary, fontSize: 12, fontWeight: '600' },
  otpRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, justifyContent: 'space-between' },
  otpBox: { width: 48, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, fontSize: 22, fontWeight: '700', color: colors.onSurface },
  otpBoxFilled: { borderColor: colors.brand, backgroundColor: '#FFF6E1' },
  error: { color: colors.error, marginTop: spacing.md, fontSize: 13 },
  cta: { marginTop: spacing.xl, height: 56, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '700', fontSize: 16 },
  resend: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  resendText: { color: colors.brandSecondary, fontWeight: '600' },
});
