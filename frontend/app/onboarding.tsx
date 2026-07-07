import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="onboarding-screen">
      <Image
        source={{ uri: 'https://images.pexels.com/photos/13849283/pexels-photo-13849283.jpeg' }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={['rgba(247,246,242,0.2)', 'rgba(247,246,242,0.85)', '#F7F6F2']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Text style={styles.brandMark}>◈</Text>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.h1}>Awaken{"\n"}Your True Self</Text>
          <Text style={styles.sub}>Meditation, Yoga and Wisdom{"\n"}for a better you.</Text>
          <Pressable
            testID="onboarding-continue-btn"
            onPress={() => router.push('/(auth)/login')}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.ctaText}>Begin Your Journey</Text>
          </Pressable>
          <Text style={styles.footer}>Founded by Guruji Sundar · Aathman Awareness Center</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.xl },
  brandMark: { fontSize: 28, color: colors.brand, letterSpacing: 6 },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  h1: { fontFamily: fonts.display, fontSize: 44, lineHeight: 52, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  sub: { textAlign: 'center', color: colors.muted, marginTop: spacing.md, fontSize: 15, lineHeight: 22 },
  cta: { marginTop: spacing.xl, height: 56, backgroundColor: colors.brand, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.onBrand, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: spacing.md },
});
