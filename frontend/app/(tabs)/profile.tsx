import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function ProfileTab() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>({ total_sessions: 0, total_minutes: 0, mantra_count: 0, streak: 0 });

  const load = useCallback(async () => {
    try { setStats(await api.get('/stats/me')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const initials = (user?.name || 'A').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="profile-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.h1}>Profile</Text>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || 'Seeker'}</Text>
            <Text style={styles.identifier}>{user?.identifier}</Text>
            {user?.state ? <Text style={styles.hint}>{user.state} · {user.nationality || 'India'}</Text> : null}
          </View>
          <Pressable testID="edit-profile" style={styles.editBtn} onPress={() => router.push('/(auth)/profile-setup')}>
            <Ionicons name="pencil" size={16} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatBox icon="time" label="Minutes" value={String(stats.total_minutes)} tint="#FFF6E1" testID="stat-minutes" />
          <StatBox icon="leaf" label="Sessions" value={String(stats.total_sessions)} tint="#D9F5E9" testID="stat-sessions" />
          <StatBox icon="flame" label="Streak" value={`${stats.streak}d`} tint="#FEE4E2" testID="stat-streak" />
          <StatBox icon="hand-left" label="Mantras" value={String(stats.mantra_count)} tint="#EEE9FF" testID="stat-mantras" />
        </View>

        {/* Navigation */}
        <View style={styles.menu}>
          <MenuItem icon="stats-chart-outline" label="My Stats & Rank" onPress={() => router.push('/stats')} testID="menu-stats" />
          <MenuItem icon="sparkles-outline" label="Aathman Awareness Centre" onPress={() => router.push('/community')} testID="menu-community" />
          <MenuItem icon="hand-left-outline" label="Mantra Jaap" onPress={() => router.push('/mantra')} testID="menu-mantra" />
          <MenuItem icon="moon-outline" label="Sleep" onPress={() => router.push('/sleep')} testID="menu-sleep" />
          <MenuItem icon="book-outline" label="Books & Magazines" onPress={() => router.push('/books')} testID="menu-books" />
          <MenuItem icon="chatbubble-ellipses-outline" label="Q & A" onPress={() => router.push('/qa')} testID="menu-qa" />
          <MenuItem icon="sparkles-outline" label="Message from Guruji" onPress={() => router.push('/guru-messages')} testID="menu-guru" />
          <MenuItem icon="alert-circle-outline" label="SOS Counselling" onPress={() => router.push('/sos')} testID="menu-sos" danger />
        </View>

        <Pressable testID="logout-btn" onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatBox({ icon, label, value, tint, testID }: { icon: any; label: string; value: string; tint: string; testID: string }) {
  return (
    <View testID={testID} style={[styles.statBox, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={18} color={colors.onSurface} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, testID, danger }: { icon: any; label: string; onPress: () => void; testID: string; danger?: boolean }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.menuItem}>
      <Ionicons name={icon} size={20} color={danger ? colors.error : colors.onSurface} />
      <Text style={[styles.menuText, danger && { color: colors.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  h1: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: colors.onSurface },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onBrand, fontWeight: '700', fontSize: 20 },
  name: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  identifier: { fontSize: 12, color: colors.muted, marginTop: 2 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  editBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  statBox: { width: '47%', flexGrow: 1, padding: spacing.md, borderRadius: radius.lg, minHeight: 90 },
  statValue: { fontFamily: fonts.display, fontSize: 26, fontWeight: '700', color: colors.onSurface, marginTop: 6 },
  statLabel: { color: colors.mutedStrong, fontSize: 12, fontWeight: '600' },
  menu: { marginTop: spacing.lg, marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuText: { flex: 1, fontSize: 14, color: colors.onSurface, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.error },
  logoutText: { color: colors.error, fontWeight: '700' },
});
