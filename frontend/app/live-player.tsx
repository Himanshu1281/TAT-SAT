import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing } from '@/src/theme';

export default function LivePlayer() {
  const { ytid, channel, title } = useLocalSearchParams<{ ytid?: string; channel?: string; title?: string }>();
  const router = useRouter();

  const src = channel
    ? `https://www.youtube.com/embed/live_stream?channel=${channel}&autoplay=1&playsinline=1&rel=0`
    : `https://www.youtube.com/embed/${ytid}?autoplay=1&playsinline=1&rel=0`;

  const openOnYouTube = () => {
    const url = channel
      ? `https://www.youtube.com/channel/${channel}/live`
      : `https://www.youtube.com/watch?v=${ytid}`;
    Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="live-player">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="live-close" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{String(title || 'Live')}</Text>
          <Pressable testID="live-open-youtube" onPress={openOnYouTube} style={styles.iconBtn}>
            <Ionicons name="logo-youtube" size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.playerWrap}>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <iframe src={src} style={{ width: '100%', height: '100%', border: 0 }} allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
          ) : (
            <WebView
              source={{ uri: src }}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />}
              style={{ flex: 1, backgroundColor: '#000' }}
            />
          )}
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>You&apos;re here. Presence itself is prayer.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontWeight: '700', flex: 1, textAlign: 'center', paddingHorizontal: 8 },
  playerWrap: { flex: 1, backgroundColor: '#000' },
  footer: { padding: spacing.lg, alignItems: 'center' },
  footerText: { color: colors.brand, fontStyle: 'italic', fontSize: 13 },
});
