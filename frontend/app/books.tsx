import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { getCart } from '@/src/cart';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Books() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [books, cart] = await Promise.all([api.get('/books'), getCart()]);
      setRows(books);
      setCartCount(cart.reduce((s, i) => s + i.quantity, 0));
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="books-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="books-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Books & Magazines</Text>
          <Pressable testID="open-cart" onPress={() => router.push('/cart')} style={styles.iconBtn}>
            <Ionicons name="bag-outline" size={20} color={colors.onSurface} />
            {cartCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View> : null}
          </Pressable>
        </View>
      </SafeAreaView>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable testID={`book-${item.id}`} onPress={() => router.push({ pathname: '/book-detail', params: { id: item.id } })} style={styles.card}>
              <Image source={{ uri: item.cover }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
                <Text style={styles.name}>{item.title}</Text>
                <Text style={styles.author}>{item.author}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={12} color={colors.brand} />
                  <Text style={styles.meta}>{item.rating}</Text>
                  <Text style={[styles.meta, { marginLeft: 12, color: colors.onSurface, fontWeight: '700' }]}>₹{item.price}</Text>
                </View>
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
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: colors.brand, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, color: colors.onBrand, fontWeight: '700' },
  card: { flexDirection: 'row', gap: spacing.md, padding: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  img: { width: 80, height: 100, borderRadius: radius.sm },
  kind: { color: colors.brandSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  name: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.onSurface, marginTop: 2 },
  author: { color: colors.muted, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  meta: { color: colors.mutedStrong, fontSize: 12 },
});
