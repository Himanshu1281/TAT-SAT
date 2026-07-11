import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const SOCIAL_ICON: Record<string, any> = {
  Instagram: 'logo-instagram',
  Facebook: 'logo-facebook',
  YouTube: 'logo-youtube',
  LinkedIn: 'logo-linkedin',
  WhatsApp: 'logo-whatsapp',
  Reddit: 'logo-reddit',
  Amazon: 'cart',
};

export default function Community() {
  const router = useRouter();
  const [info, setInfo] = useState<any>(null);

  useEffect(() => { (async () => { setInfo(await api.get('/community/info')); })(); }, []);

  if (!info) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="community-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={{ uri: info.hero_image }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
          <LinearGradient colors={['rgba(16,24,40,0.3)', 'rgba(16,24,40,0.85)']} style={StyleSheet.absoluteFill as any} />
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={styles.headerRow}>
              <Pressable testID="community-back" onPress={() => router.back()} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </Pressable>
              <Pressable testID="community-visit" onPress={() => Linking.openURL(info.website)} style={styles.iconBtn}>
                <Ionicons name="open-outline" size={18} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTag}>AATHMAN AWARENESS CENTRE</Text>
              <Text style={styles.heroName}>{info.name}</Text>
              <Text style={styles.heroTagline}>{info.tagline}</Text>
            </View>
          </SafeAreaView>
        </View>

        {/* Quote card */}
        <View style={styles.quoteCard} testID="founder-quote">
          <Image source={{ uri: info.guru_image }} style={styles.guruImg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteText}>&ldquo;{info.quote}&rdquo;</Text>
            <Text style={styles.quoteBy}>— {info.quote_author}</Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who We Are</Text>
          <Text style={styles.para}>{info.about}</Text>
        </View>

        {/* Courses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Courses</Text>
          <Text style={styles.sectionHint}>Learn directly from His Holiness</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {info.courses.map((c: any) => (
            <Pressable
              key={c.id}
              testID={`course-${c.id}`}
              onPress={() => Linking.openURL(c.url)}
              style={styles.courseCard}
            >
              <Image source={{ uri: c.cover }} style={styles.courseImg} contentFit="cover" />
              <Text style={styles.courseTitle} numberOfLines={2}>{c.title}</Text>
              <Text style={styles.courseDesc} numberOfLines={2}>{c.description}</Text>
              <View style={styles.viewLink}>
                <Text style={styles.viewLinkText}>View Course</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.brand} />
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Articles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wisdom Articles</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {info.articles.map((a: any) => (
            <Pressable
              key={a.title}
              testID={`article-${a.title}`}
              onPress={() => Linking.openURL(a.url)}
              style={styles.articleCard}
            >
              <Image source={{ uri: a.cover }} style={styles.articleImg} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.articleTitle} numberOfLines={2}>{a.title}</Text>
                <Text style={styles.articleExcerpt} numberOfLines={3}>{a.excerpt}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        {/* Guru quote */}
        <View style={styles.deepQuote} testID="guru-deep-quote">
          <Text style={styles.deepQuoteMark}>“</Text>
          <Text style={styles.deepQuoteText}>{info.guru_quote}</Text>
          <Text style={styles.deepQuoteBy}>— HH Guruji Sundar</Text>
        </View>

        {/* Testimonials */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voices of Seekers</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {info.testimonials.map((t: any) => (
            <View key={t.name} style={styles.testimonial}>
              <Text style={styles.testimonialText}>&ldquo;{t.text}&rdquo;</Text>
              <Text style={styles.testimonialBy}>— {t.name}</Text>
            </View>
          ))}
        </View>

        {/* Socials */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connect</Text>
        </View>
        <View style={styles.socialsWrap}>
          {info.socials.map((s: any) => (
            <Pressable
              key={s.platform}
              testID={`social-${s.platform}`}
              onPress={() => Linking.openURL(s.url)}
              style={styles.socialBtn}
            >
              <Ionicons name={SOCIAL_ICON[s.platform] || 'link'} size={18} color={colors.onSurface} />
              <Text style={styles.socialLabel}>{s.platform}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          testID="visit-shop-community"
          onPress={() => Linking.openURL(info.shop)}
          style={styles.shopCta}
        >
          <Ionicons name="book" size={16} color={colors.onBrand} />
          <Text style={styles.shopCtaText}>Buy Brahmatheerth Magazines</Text>
        </Pressable>

        <Text style={styles.footer}>© Aathman Awareness Centre · aathmanawarenesscentre.com</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 300, backgroundColor: '#101828' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  heroBody: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  heroTag: { color: colors.brand, fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  heroName: { fontFamily: fonts.display, color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 4, lineHeight: 38 },
  heroTagline: { color: 'rgba(255,255,255,0.85)', marginTop: 8, fontSize: 14, lineHeight: 20 },
  quoteCard: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginHorizontal: spacing.lg, marginTop: -32, padding: spacing.md, backgroundColor: '#FFF6E1', borderRadius: radius.lg, borderWidth: 1, borderColor: '#FFE8B8' },
  guruImg: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.surfaceTertiary },
  quoteText: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 16, lineHeight: 22, fontStyle: 'italic' },
  quoteBy: { color: colors.mutedStrong, marginTop: 6, fontWeight: '700', fontSize: 12 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface },
  sectionHint: { color: colors.muted, marginTop: 2, fontSize: 12 },
  para: { color: colors.mutedStrong, lineHeight: 22, fontSize: 14, marginTop: 4 },
  hRow: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 4 },
  courseCard: { width: 200, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', padding: spacing.sm },
  courseImg: { width: '100%', height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  courseTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.onSurface, marginTop: 6 },
  courseDesc: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  viewLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  viewLinkText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  articleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  articleImg: { width: 68, height: 68, borderRadius: radius.md },
  articleTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.onSurface },
  articleExcerpt: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  deepQuote: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: '#101828' },
  deepQuoteMark: { fontFamily: fonts.display, color: colors.brand, fontSize: 48, lineHeight: 42 },
  deepQuoteText: { fontFamily: fonts.display, color: '#fff', fontSize: 18, lineHeight: 24, marginTop: 4, fontStyle: 'italic' },
  deepQuoteBy: { color: 'rgba(255,255,255,0.65)', marginTop: 8, fontWeight: '600', fontSize: 12 },
  testimonial: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  testimonialText: { color: colors.onSurface, fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  testimonialBy: { color: colors.mutedStrong, marginTop: 8, fontWeight: '700', fontSize: 12 },
  socialsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  socialLabel: { color: colors.onSurface, fontSize: 12, fontWeight: '600' },
  shopCta: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginTop: spacing.xl, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  shopCtaText: { color: colors.onBrand, fontWeight: '700' },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: spacing.lg },
});
