import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aathman_cart_v1';

export type CartItem = { book_id: string; title: string; price: number; cover: string; quantity: number };

export async function getCart(): Promise<CartItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function saveCart(items: CartItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function addToCart(item: Omit<CartItem, 'quantity'>): Promise<CartItem[]> {
  const items = await getCart();
  const existing = items.find(i => i.book_id === item.book_id);
  if (existing) existing.quantity += 1;
  else items.push({ ...item, quantity: 1 });
  await saveCart(items);
  return items;
}

export async function removeFromCart(book_id: string): Promise<CartItem[]> {
  const items = (await getCart()).filter(i => i.book_id !== book_id);
  await saveCart(items);
  return items;
}

export async function updateQuantity(book_id: string, quantity: number): Promise<CartItem[]> {
  const items = await getCart();
  const item = items.find(i => i.book_id === book_id);
  if (item) item.quantity = Math.max(1, quantity);
  await saveCart(items);
  return items;
}

export async function clearCart() {
  await AsyncStorage.removeItem(KEY);
}
