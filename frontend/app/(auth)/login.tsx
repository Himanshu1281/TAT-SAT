import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Login() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await signInWithGoogle();
      // On web, redirect happens via window.location — nothing else to do here.
      if (!res) return;
      if (res.is_new) router.replace('/(auth)/profile-setup');
      else router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="login-screen">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))} testID="login-back-btn">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.body}>
          <Text style={styles.title}>Namaste</Text>
          <Text style={styles.subtitle}>Sign in to continue your{"\n"}spiritual journey</Text>

          <View style={{ height: spacing.xxxl }} />

          <Pressable
            testID="google-signin-btn"
            disabled={loading}
            onPress={onGoogle}
            style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <View style={styles.ctaInner}>
                <View style={styles.googleMark}>
                  <Ionicons name="logo-google" size={16} color={colors.onSurface} />
                </View>
                <Text style={styles.ctaText}>Sign in with Google</Text>
              </View>
            )}
          </Pressable>

          {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

          <Text style={styles.tos}>By continuing, you agree to I Tat Sat&apos;s Terms &amp; <Text testID="privacy-link" style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://itatsat.com/#privacy')}>Privacy Policy</Text>.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  back: { padding: spacing.md, marginLeft: spacing.xs, alignSelf: 'flex-start' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 40, fontWeight: '700', color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: spacing.sm, fontSize: 15, lineHeight: 22 },
  cta: {
    height: 56,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: colors.onBrand, fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  error: { color: colors.error, marginTop: spacing.md, fontSize: 13, textAlign: 'center' },
  tos: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: spacing.md },
});
