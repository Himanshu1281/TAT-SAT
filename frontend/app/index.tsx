import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, fonts } from '@/src/theme';

export default function Splash() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!user) router.replace('/onboarding');
      else if (!user.onboarded) router.replace('/(auth)/profile-setup');
      else router.replace('/(tabs)');
    }, 900);
    return () => clearTimeout(t);
  }, [user, loading, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <LinearGradient
        colors={['#F7F6F2', '#ECE8E1', '#FFE8B8']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1608900203293-ebc770fac3f9?w=400' }}
            style={styles.logo}
            contentFit="cover"
          />
        </View>
        <Text style={styles.title}>I TAT SAT</Text>
        <Text style={styles.subtitle}>Awaken Within</Text>
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brand} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  logo: { width: '100%', height: '100%' },
  title: { fontFamily: fonts.display, fontSize: 40, fontWeight: '700', color: colors.onSurface, letterSpacing: 8 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: spacing.sm, letterSpacing: 2 },
});
