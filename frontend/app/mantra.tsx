import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

const MANTRAS = ['Om Namah Shivaya', 'Om Namo Narayanaya', 'Hare Krishna', 'Om Mani Padme Hum', 'Gayatri Mantra'];

export default function MantraJaap() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [mantra, setMantra] = useState(MANTRAS[0]);
  const [pending, setPending] = useState(0);
  const [saving, setSaving] = useState(false);

  const tap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCount(c => c + 1);
    setPending(p => p + 1);
    if ((count + 1) % 108 === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const save = async () => {
    if (pending === 0) return;
    setSaving(true);
    try {
      await api.post('/mantra/increment', { mantra, count: pending });
      setPending(0);
    } finally { setSaving(false); }
  };

  const reset = () => { setCount(0); setPending(0); };

  const mala = count % 108;
  const malaProgress = (mala / 108) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: '#101828' }} testID="mantra-screen">
      <LinearGradient colors={['#2A1E4A', '#101828']} style={StyleSheet.absoluteFill as any} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="mantra-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Mantra Jaap</Text>
          <Pressable testID="mantra-reset" onPress={reset} style={styles.iconBtn}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.selectorWrap}>
          {MANTRAS.map(m => (
            <Pressable key={m} testID={`mantra-opt-${m}`} onPress={() => setMantra(m)} style={[styles.chip, mantra === m && styles.chipActive]}>
              <Text style={[styles.chipText, mantra === m && styles.chipTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.centerWrap}>
          <Text style={styles.mantraText}>{mantra}</Text>
          <Pressable testID="mantra-tap" onPress={tap} style={styles.bead}>
            <View style={styles.beadInner}>
              <Text style={styles.beadCount}>{count}</Text>
              <Text style={styles.beadHint}>tap to chant</Text>
            </View>
          </Pressable>
          <View style={styles.malaRow}>
            <Text style={styles.malaLabel}>Mala {Math.floor(count / 108)}</Text>
            <View style={styles.malaBar}><View style={[styles.malaFill, { width: `${malaProgress}%` }]} /></View>
            <Text style={styles.malaLabel}>{mala}/108</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable testID="mantra-save" onPress={save} disabled={pending === 0 || saving} style={[styles.saveBtn, (pending === 0 || saving) && { opacity: 0.5 }]}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.onBrand} />
            <Text style={styles.saveText}>Save +{pending}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontWeight: '700', fontSize: 16 },
  selectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.md },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: '#fff', fontSize: 12 },
  chipTextActive: { color: colors.onBrand, fontWeight: '700' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  mantraText: { fontFamily: fonts.display, fontSize: 28, color: colors.brand, marginBottom: spacing.lg },
  bead: { width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,186,61,0.15)', borderWidth: 2, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  beadInner: { width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,186,61,0.2)', alignItems: 'center', justifyContent: 'center' },
  beadCount: { fontFamily: fonts.display, fontSize: 80, color: '#fff', fontWeight: '700' },
  beadHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  malaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, width: '100%' },
  malaLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  malaBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  malaFill: { height: '100%', backgroundColor: colors.brand },
  footer: { padding: spacing.lg },
  saveBtn: { flexDirection: 'row', gap: 6, alignSelf: 'center', backgroundColor: colors.brand, paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.pill, alignItems: 'center' },
  saveText: { color: colors.onBrand, fontWeight: '700' },
});
