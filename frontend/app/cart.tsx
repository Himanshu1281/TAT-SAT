import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { CartItem, clearCart, getCart, removeFromCart, updateQuantity } from '@/src/cart';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Cart() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [address, setAddress] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderDone, setOrderDone] = useState<any | null>(null);

  const load = useCallback(async () => setItems(await getCart()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const change = async (id: string, delta: number) => {
    const it = items.find(i => i.book_id === id);
    if (!it) return;
    const next = it.quantity + delta;
    if (next < 1) return;
    setItems(await updateQuantity(id, next));
  };

  const remove = async (id: string) => setItems(await removeFromCart(id));

  const checkout = async () => {
    if (!items.length || !address.trim()) return;
    setCheckingOut(true);
    try {
      const create = await api.post('/orders/create', {
        items: items.map(i => ({ book_id: i.book_id, quantity: i.quantity })),
        address,
        payment_method: 'razorpay',
      });
      // MOCK payment success (real Razorpay requires native SDK). Backend accepts empty verify.
      const verify = await api.post('/orders/verify', { order_id: create.order.id });
      if (verify.ok) {
        await clearCart();
        setItems([]);
        setOrderDone(create.order);
      }
    } finally { setCheckingOut(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="cart-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="cart-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>My Cart</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      {items.length === 0 && !orderDone ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🛍️</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Pressable testID="shop-books" onPress={() => router.replace('/books')} style={styles.shopBtn}>
            <Text style={styles.shopText}>Browse Books</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          {items.map(it => (
            <View key={it.book_id} style={styles.item} testID={`cart-item-${it.book_id}`}>
              <Image source={{ uri: it.cover }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={2}>{it.title}</Text>
                <Text style={styles.itemPrice}>₹{it.price}</Text>
                <View style={styles.qtyRow}>
                  <Pressable testID={`dec-${it.book_id}`} onPress={() => change(it.book_id, -1)} style={styles.qtyBtn}><Ionicons name="remove" size={14} color={colors.onSurface} /></Pressable>
                  <Text style={styles.qty}>{it.quantity}</Text>
                  <Pressable testID={`inc-${it.book_id}`} onPress={() => change(it.book_id, 1)} style={styles.qtyBtn}><Ionicons name="add" size={14} color={colors.onSurface} /></Pressable>
                  <Pressable testID={`rm-${it.book_id}`} onPress={() => remove(it.book_id)} style={{ marginLeft: 'auto', padding: 6 }}><Ionicons name="trash-outline" size={16} color={colors.error} /></Pressable>
                </View>
              </View>
            </View>
          ))}
          <Text style={styles.section}>Shipping Address</Text>
          <TextInput
            testID="cart-address"
            value={address}
            onChangeText={setAddress}
            placeholder="Your full address"
            placeholderTextColor={colors.muted}
            style={styles.addressInput}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.summary}>
            <View style={styles.summaryRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumVal}>₹{total}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.sumLabel}>Shipping</Text><Text style={styles.sumVal}>Free</Text></View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 }]}>
              <Text style={styles.totalLabel}>Total</Text><Text style={styles.total}>₹{total}</Text>
            </View>
          </View>
          <Pressable testID="pay-btn" onPress={checkout} disabled={checkingOut || !address.trim()} style={[styles.payBtn, (checkingOut || !address.trim()) && { opacity: 0.5 }]}>
            {checkingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Pay ₹{total} via Razorpay</Text>}
          </Pressable>
          <Text style={styles.note}>Payments are secured. Razorpay integration is mocked in this preview.</Text>
        </ScrollView>
      )}

      <Modal transparent visible={!!orderDone} animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard} testID="order-success">
            <View style={styles.doneCircle}><Ionicons name="checkmark" size={40} color="#fff" /></View>
            <Text style={styles.doneTitle}>Order Placed!</Text>
            <Text style={styles.doneBody}>Order ID: {orderDone?.id?.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.doneBody}>Total: ₹{orderDone?.amount}</Text>
            <Pressable testID="continue-shopping" onPress={() => { setOrderDone(null); router.replace('/(tabs)'); }} style={styles.homeBtn}>
              <Text style={styles.homeText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  title: { fontWeight: '700', color: colors.onSurface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface },
  shopBtn: { marginTop: 12, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  shopText: { color: colors.onBrand, fontWeight: '700' },
  item: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  img: { width: 64, height: 84, borderRadius: 6 },
  itemTitle: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.onSurface },
  itemPrice: { color: colors.mutedStrong, fontWeight: '700', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  qty: { fontWeight: '700', minWidth: 20, textAlign: 'center' },
  section: { marginTop: spacing.md, fontWeight: '700', color: colors.mutedStrong, fontSize: 13 },
  addressInput: { marginTop: spacing.sm, minHeight: 80, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 14 },
  summary: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { color: colors.mutedStrong },
  sumVal: { color: colors.onSurface, fontWeight: '600' },
  totalLabel: { fontWeight: '700', color: colors.onSurface },
  total: { fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.onSurface },
  payBtn: { marginTop: spacing.md, height: 54, backgroundColor: colors.onSurface, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  payText: { color: '#fff', fontWeight: '700' },
  note: { textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(16,24,40,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radius.lg, alignItems: 'center' },
  doneCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.display, fontSize: 26, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md },
  doneBody: { color: colors.mutedStrong, marginTop: 4 },
  homeBtn: { marginTop: spacing.lg, backgroundColor: colors.brand, paddingHorizontal: spacing.xl, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  homeText: { color: colors.onBrand, fontWeight: '700' },
});
