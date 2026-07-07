import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function GuruMessages() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { setRows(await api.get('/guru/messages')); setLoading(false); })(); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="guru-messages-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="guru-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Message from Guruji</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`guru-${item.id}`}>
              <Image source={{ uri: item.cover }} style={styles.img} contentFit="cover" />
              <View style={styles.body}>
                <Text style={styles.author}>— {item.author}</Text>
                <Text style={styles.headline}>{item.title}</Text>
                <Text style={styles.text}>{item.body}</Text>
              </View>
            </View>
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
  card: { backgroundColor: '#101828', borderRadius: radius.lg, overflow: 'hidden' },
  img: { width: '100%', height: 180 },
  body: { padding: spacing.lg },
  author: { color: colors.brand, fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  headline: { fontFamily: fonts.display, color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 4 },
  text: { color: '#D6DAE3', marginTop: spacing.sm, lineHeight: 22, fontSize: 14 },
});
