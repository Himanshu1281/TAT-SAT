import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { addToCart } from '@/src/cart';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => { (async () => { setBook(await api.get(`/books/${id}`)); })(); }, [id]);

  const add = async () => {
    if (!book) return;
    await addToCart({ book_id: book.id, title: book.title, price: book.price, cover: book.cover });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (!book) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="book-detail-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="book-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="detail-open-cart" onPress={() => router.push('/cart')} style={styles.iconBtn}>
            <Ionicons name="bag-outline" size={20} color={colors.onSurface} />
          </Pressable>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ alignItems: 'center', padding: spacing.lg }}>
          <Image source={{ uri: book.cover }} style={styles.cover} contentFit="cover" />
        </View>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={styles.author}>{book.author}</Text>
          <Text style={styles.title}>{book.title}</Text>
          <View style={styles.row}>
            <Ionicons name="star" size={14} color={colors.brand} />
            <Text style={styles.rating}>{book.rating}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.rating}>{book.kind}</Text>
          </View>
          <Text style={styles.section}>About the Book</Text>
          <Text style={styles.desc}>{book.description}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <View>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.price}>₹{book.price}</Text>
        </View>
        <Pressable testID="add-to-cart" onPress={add} style={styles.cta}>
          <Ionicons name="bag-add" size={18} color={colors.onBrand} />
          <Text style={styles.ctaText}>{added ? 'Added ✓' : 'Add to Cart'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  cover: { width: 200, height: 260, borderRadius: radius.md },
  author: { color: colors.brandSecondary, fontWeight: '700', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: colors.onSurface, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  rating: { color: colors.mutedStrong, fontSize: 13, fontWeight: '600' },
  dot: { color: colors.muted, marginHorizontal: 4 },
  section: { marginTop: spacing.lg, fontWeight: '700', color: colors.mutedStrong, fontSize: 13, letterSpacing: 1 },
  desc: { marginTop: spacing.sm, color: colors.onSurface, lineHeight: 22, fontSize: 15 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { color: colors.muted, fontSize: 11 },
  price: { fontFamily: fonts.display, fontSize: 24, fontWeight: '700', color: colors.onSurface },
  cta: { flexDirection: 'row', gap: 6, backgroundColor: colors.onSurface, paddingHorizontal: spacing.lg, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontWeight: '700' },
});
