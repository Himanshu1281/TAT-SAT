import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const SHOP_URL = 'https://gurujisundar.com/shop/';

export default function Books() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get('/books')); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openShop = () => Linking.openURL(SHOP_URL);
  const openBook = (b: any) => Linking.openURL(b.external_url || SHOP_URL);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="books-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="books-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Books & Magazines</Text>
          <Pressable testID="open-shop" onPress={openShop} style={styles.iconBtn}>
            <Ionicons name="open-outline" size={18} color={colors.onSurface} />
          </Pressable>
        </View>
      </SafeAreaView>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={
            <View style={styles.hero}>
              <LinearGradient colors={['#FFF6E1', '#F7F6F2']} style={StyleSheet.absoluteFill as any} />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTag}>BRAHMATHEERTH</Text>
                <Text style={styles.heroTitle}>Saint Sundar&apos;s Elixir of Divine Wisdom</Text>
                <Text style={styles.heroDesc}>A spontaneous outpouring of Wisdom from the beyond — published by Aathman Awareness Centre.</Text>
                <Pressable testID="visit-shop-btn" onPress={openShop} style={styles.heroBtn}>
                  <Ionicons name="globe-outline" size={14} color={colors.onBrand} />
                  <Text style={styles.heroBtnText}>Visit gurujisundar.com/shop</Text>
                </Pressable>
              </View>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable testID={`book-${item.id}`} onPress={() => openBook(item)} style={styles.card}>
              <Image source={{ uri: item.cover }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.kind}>{(item.kind || 'MAGAZINE').toUpperCase()}</Text>
                <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.author}>{item.author}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={12} color={colors.brand} />
                  <Text style={styles.meta}>{item.rating}</Text>
                  <Text style={styles.price}>₹{item.price}</Text>
                </View>
              </View>
              <View style={styles.buyBtn}>
                <Ionicons name="open-outline" size={14} color={colors.onBrand} />
                <Text style={styles.buyText}>Buy</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  title: { fontWeight: '700', color: colors.onSurface },
  hero: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: '#FFE8B8', overflow: 'hidden' },
  heroTag: { color: colors.brand, fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  heroTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface, marginTop: 6, lineHeight: 28 },
  heroDesc: { color: colors.mutedStrong, marginTop: 6, fontSize: 13, lineHeight: 20 },
  heroBtn: { marginTop: spacing.md, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brand, paddingHorizontal: 14, height: 40, borderRadius: radius.pill },
  heroBtnText: { color: colors.onBrand, fontWeight: '700', fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  img: { width: 76, height: 100, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  kind: { color: colors.brandSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  name: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.onSurface, marginTop: 2 },
  author: { color: colors.muted, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  meta: { color: colors.mutedStrong, fontSize: 12 },
  price: { marginLeft: 12, color: colors.onSurface, fontWeight: '700', fontSize: 14 },
  buyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.onSurface, paddingHorizontal: 12, height: 36, borderRadius: radius.pill },
  buyText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
