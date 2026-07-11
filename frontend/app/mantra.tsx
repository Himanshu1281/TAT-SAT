import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/src/api/client';
import { colors, spacing, radius, fonts } from '@/src/theme';

type Mantra = { key: string; name: string; text: string; short?: string };

const DEFAULT_MANTRAS: Mantra[] = [
  { key: 'ram', name: 'Sri Ram Naam', text: 'Om Sri Ram Jai Ram Jai Jai Ram', short: 'Om Sri Ram Jai Ram Jai Jai Ram' },
  { key: 'shiva', name: 'Om Namah Shivaya', text: 'Om Namah Shivaya', short: 'Om Namah Shivaya' },
  { key: 'ganesh', name: 'Ganapati Mantra', text: 'Om Gam Ganapataye Namah', short: 'Om Gam Ganapataye Namah' },
  { key: 'gayatri', name: 'Gayatri Mantra', text: 'Om Bhur Bhuvah Svah\nTat Savitur Varenyam\nBhargo Devasya Dhimahi\nDhiyo Yo Nah Prachodayat', short: 'Om Bhur Bhuvah Svah…' },
  { key: 'maha', name: 'Maha Mantra', text: 'Hare Krishna Hare Krishna\nKrishna Krishna Hare Hare\nHare Rama Hare Rama\nRama Rama Hare Hare', short: 'Hare Krishna Hare Rama' },
];

const CUSTOM_KEY = 'aathman_custom_mantra_v1';
const MALA_SIZE = 108;

// Precompute bead positions on a circle
function useBeadPositions(diameter: number, count: number) {
  return useMemo(() => {
    const r = diameter / 2 - 14; // padding for bead radius
    const cx = diameter / 2;
    const cy = diameter / 2;
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2; // start at top
      positions.push({ x: cx + r * Math.cos(angle) - 6, y: cy + r * Math.sin(angle) - 6 });
    }
    return positions;
  }, [diameter, count]);
}

export default function MantraJaap() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [pending, setPending] = useState(0);
  const [mantras, setMantras] = useState<Mantra[]>(DEFAULT_MANTRAS);
  const [selectedKey, setSelectedKey] = useState<string>('shiva');
  const [customText, setCustomText] = useState<string>('');
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const diameter = 320;
  const beadPositions = useBeadPositions(diameter, MALA_SIZE);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(CUSTOM_KEY);
      if (raw) {
        setCustomText(raw);
        setMantras([...DEFAULT_MANTRAS, { key: 'custom', name: 'My Own Mantra', text: raw, short: raw }]);
      }
    })();
  }, []);

  const selected = mantras.find(m => m.key === selectedKey) || DEFAULT_MANTRAS[1];
  const mala = count % MALA_SIZE;
  const malaCompleted = Math.floor(count / MALA_SIZE);

  const tap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCount(c => {
      const next = c + 1;
      if (next % MALA_SIZE === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return next;
    });
    setPending(p => p + 1);
  };

  const reset = () => {
    Haptics.selectionAsync();
    setCount(0);
    setPending(0);
  };

  const save = async () => {
    if (pending === 0) return;
    setSaving(true);
    try {
      await api.post('/mantra/increment', { mantra: selected.name, count: pending });
      setPending(0);
    } finally { setSaving(false); }
  };

  const openCustom = () => {
    setCustomDraft(customText);
    setCustomModalOpen(true);
  };

  const saveCustom = async () => {
    const t = customDraft.trim();
    if (!t) return;
    await AsyncStorage.setItem(CUSTOM_KEY, t);
    setCustomText(t);
    const withCustom = [...DEFAULT_MANTRAS, { key: 'custom', name: 'My Own Mantra', text: t, short: t }];
    setMantras(withCustom);
    setSelectedKey('custom');
    setCustomModalOpen(false);
  };

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mantraChipRow}>
          {mantras.map(m => (
            <Pressable
              key={m.key}
              testID={`mantra-opt-${m.key}`}
              onPress={() => setSelectedKey(m.key)}
              style={[styles.chip, { flexShrink: 0 }, selectedKey === m.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedKey === m.key && styles.chipTextActive]} numberOfLines={1}>{m.name}</Text>
            </Pressable>
          ))}
          <Pressable testID="mantra-custom-btn" onPress={openCustom} style={[styles.chip, styles.chipCustom, { flexShrink: 0 }]}>
            <Ionicons name={customText ? 'create-outline' : 'add'} size={14} color={colors.brand} />
            <Text style={[styles.chipText, { color: colors.brand, marginLeft: 4 }]}>{customText ? 'Edit Mine' : 'Add Mine'}</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.chantWrap}>
          <Text style={styles.mantraText} numberOfLines={4}>{selected.text}</Text>
        </View>

        <View style={styles.malaCenter}>
          <View style={[styles.malaWrap, { width: diameter, height: diameter }]}>
            {/* Ring guide */}
            <View style={[styles.ringGuide, { width: diameter - 4, height: diameter - 4, borderRadius: (diameter - 4) / 2 }]} />
            {beadPositions.map((p, i) => {
              const lit = i < mala;
              const isTopBead = i === 0;
              return (
                <View
                  key={i}
                  testID={`bead-${i}`}
                  style={[
                    styles.bead,
                    { left: p.x, top: p.y },
                    lit && styles.beadLit,
                    isTopBead && styles.beadTop,
                  ]}
                />
              );
            })}
            {/* Center */}
            <Pressable testID="mantra-tap" onPress={tap} style={styles.centerTap}>
              <Text style={styles.centerCount}>{mala}</Text>
              <Text style={styles.centerOfCount}>/ {MALA_SIZE}</Text>
              <Text style={styles.centerHint}>tap to chant</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{count}</Text>
            <Text style={styles.statLabel}>Chants</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{malaCompleted}</Text>
            <Text style={styles.statLabel}>{malaCompleted === 1 ? 'Mala' : 'Malas'}</Text>
          </View>
          <Pressable testID="mantra-save" onPress={save} disabled={pending === 0 || saving} style={[styles.saveBtn, (pending === 0 || saving) && { opacity: 0.4 }]}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.onBrand} />
            <Text style={styles.saveText}>Save +{pending}</Text>
          </Pressable>
        </View>

        {mala === 0 && count > 0 ? (
          <Text style={styles.malaBadge} testID="mala-complete-toast">🌸 Mala {malaCompleted} completed</Text>
        ) : null}
      </SafeAreaView>

      {/* Custom mantra modal */}
      <Modal visible={customModalOpen} transparent animationType="fade" onRequestClose={() => setCustomModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
          <View style={styles.modalCard} testID="custom-mantra-modal">
            <Text style={styles.modalTitle}>My Own Mantra</Text>
            <Text style={styles.modalHint}>Type any mantra. It stays on this device.</Text>
            <TextInput
              testID="custom-mantra-input"
              value={customDraft}
              onChangeText={setCustomDraft}
              multiline
              placeholder="e.g. Om Namo Bhagavate Vasudevaya"
              placeholderTextColor={colors.muted}
              style={styles.modalInput}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <Pressable testID="custom-cancel" onPress={() => setCustomModalOpen(false)} style={styles.modalGhost}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </Pressable>
              <Pressable testID="custom-save" onPress={saveCustom} disabled={!customDraft.trim()} style={[styles.modalPrimary, !customDraft.trim() && { opacity: 0.5 }]}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontWeight: '700', fontSize: 16 },
  mantraChipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  chipCustom: { flexDirection: 'row', borderColor: colors.brand },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: '#fff', fontSize: 12, maxWidth: 160 },
  chipTextActive: { color: colors.onBrand, fontWeight: '700' },
  chantWrap: { alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, minHeight: 60 },
  mantraText: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: colors.brand, textAlign: 'center' },
  malaCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  malaWrap: { position: 'relative' },
  ringGuide: { position: 'absolute', left: 2, top: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bead: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5A3D28',
    borderWidth: 1,
    borderColor: '#7A5A3E',
  },
  beadLit: {
    backgroundColor: '#FFBA3D',
    borderColor: '#FFD98A',
    shadowColor: '#FFBA3D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  beadTop: { width: 16, height: 16, borderRadius: 8, marginLeft: -2, marginTop: -2, backgroundColor: '#D08F3F', borderColor: '#FFC46B' },
  centerTap: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerCount: { fontFamily: fonts.display, fontSize: 76, color: '#fff', fontWeight: '700', lineHeight: 80 },
  centerOfCount: { color: 'rgba(255,255,255,0.5)', marginTop: -6, fontSize: 14, fontWeight: '600' },
  centerHint: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  statVal: { fontFamily: fonts.display, fontSize: 22, color: '#fff', fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  saveBtn: { flexDirection: 'row', gap: 6, backgroundColor: colors.brand, paddingHorizontal: spacing.md, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.onBrand, fontWeight: '700' },
  malaBadge: { color: colors.brand, textAlign: 'center', marginBottom: spacing.sm, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(16,24,40,0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.onSurface },
  modalHint: { color: colors.muted, marginTop: 4, fontSize: 13 },
  modalInput: { marginTop: spacing.md, minHeight: 120, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'flex-end' },
  modalGhost: { paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modalGhostText: { color: colors.mutedStrong, fontWeight: '600' },
  modalPrimary: { paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.pill, backgroundColor: colors.onSurface, alignItems: 'center', justifyContent: 'center' },
  modalPrimaryText: { color: '#fff', fontWeight: '700' },
});
