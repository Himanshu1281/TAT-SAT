import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Linking, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/src/api/client';
import { colors, spacing, radius } from '@/src/theme';

type Mode = 'both' | 'video' | 'chat';

export default function LivePlayer() {
  const { ytid, channel, title, live } = useLocalSearchParams<{ ytid?: string; channel?: string; title?: string; live?: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('both');
  const [videoId, setVideoId] = useState<string | null>(ytid ? String(ytid) : null);
  const [isLiveNow, setIsLiveNow] = useState<boolean | null>(live === '1' ? true : live === '0' ? false : null);
  const [resolving, setResolving] = useState(!!channel && (!ytid || live == null));

  // Resolve live status / current video when the caller didn't supply them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!channel || (videoId && isLiveNow !== null)) return;
      try {
        const data = await api.get('/live/aathman-current');
        if (cancelled) return;
        if (!videoId && data?.video_id) setVideoId(data.video_id);
        setIsLiveNow(!!data?.is_live_now);
      } catch { if (!cancelled) setIsLiveNow(false); }
      finally { if (!cancelled) setResolving(false); }
    })();
    return () => { cancelled = true; };
  }, [channel, videoId, isLiveNow]);

  // Live: the channel's live_stream embed. Otherwise: play the latest stream directly,
  // since live_stream shows an "offline" screen when nothing is broadcasting.
  const videoSrc = isLiveNow && channel
    ? `https://www.youtube.com/embed/live_stream?channel=${channel}&autoplay=1&mute=1&playsinline=1&rel=0`
    : videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`
      : null;

  // YouTube's live chat popout — only meaningful while the stream is live.
  const chatSrc = isLiveNow && videoId ? `https://www.youtube.com/live_chat?v=${videoId}&is_popout=1` : null;

  const openOnYouTube = () => {
    const url = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : channel
        ? `https://www.youtube.com/channel/${channel}/live`
        : 'https://www.youtube.com/';
    Linking.openURL(url);
  };

  // Layout math for `both` mode: video keeps 16:9, chat takes the rest.
  const screenH = Dimensions.get('window').height;
  const width = Dimensions.get('window').width;
  const videoH = Math.min(Math.round((width * 9) / 16), Math.round(screenH * 0.45));

  const showVideo = mode !== 'chat' && !!videoSrc;
  const showChat = mode !== 'video' && !!chatSrc;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="live-player">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="live-close" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title} numberOfLines={1}>{String(title || 'Live')}</Text>
            {isLiveNow ? (
              <View style={styles.liveDot}><View style={styles.liveDotInner} /><Text style={styles.liveDotText}>LIVE NOW</Text></View>
            ) : null}
          </View>
          <Pressable testID="live-open-youtube" onPress={openOnYouTube} style={styles.iconBtn}>
            <Ionicons name="logo-youtube" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Mode segmented control */}
        <View style={styles.segmentWrap}>
          <View style={styles.segment}>
            {(['both', 'video', 'chat'] as Mode[]).map(m => (
              <Pressable
                key={m}
                testID={`mode-${m}`}
                onPress={() => setMode(m)}
                disabled={m === 'chat' && !chatSrc}
                style={[styles.segBtn, mode === m && styles.segActive, m === 'chat' && !chatSrc && { opacity: 0.4 }]}
              >
                <Ionicons
                  name={m === 'video' ? 'videocam' : m === 'chat' ? 'chatbubbles' : 'apps'}
                  size={13}
                  color={mode === m ? colors.onBrand : '#fff'}
                />
                <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                  {m === 'both' ? 'Both' : m === 'video' ? 'Video' : 'Chat'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Video */}
        {showVideo && videoSrc ? (
          <View style={[styles.videoBox, mode === 'both' ? { height: videoH } : { flex: 1 }]}>
            {Platform.OS === 'web' ? (
              // @ts-ignore
              <iframe src={videoSrc} style={{ width: '100%', height: '100%', border: 0 }} allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
            ) : (
              <WebView
                source={{ uri: videoSrc }}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />}
                style={{ flex: 1, backgroundColor: '#000' }}
              />
            )}
          </View>
        ) : null}

        {/* Chat */}
        {showChat && chatSrc ? (
          <View style={[styles.chatBox, mode === 'both' ? { flex: 1 } : { flex: 1 }]}>
            <View style={styles.chatHead}>
              <Ionicons name="chatbubbles" size={14} color={colors.brand} />
              <Text style={styles.chatHeadText}>Live Chat</Text>
            </View>
            {Platform.OS === 'web' ? (
              // @ts-ignore
              <iframe src={chatSrc} style={{ width: '100%', flex: 1, border: 0 }} />
            ) : (
              <WebView
                source={{ uri: chatSrc }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                thirdPartyCookiesEnabled
                sharedCookiesEnabled
                originWhitelist={['*']}
                renderLoading={() => <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />}
                style={{ flex: 1, backgroundColor: '#0F0F0F' }}
              />
            )}
          </View>
        ) : null}

        {!showVideo && !showChat ? (
          <View style={styles.emptyChat}>
            {resolving ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.emptyText}>{videoSrc ? 'Chat is available once Guruji is live.' : 'No stream available right now.'}</Text>}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontWeight: '700', paddingHorizontal: 8 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.error, paddingHorizontal: 8, height: 20, borderRadius: 10, marginTop: 2 },
  liveDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveDotText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  segmentWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.pill, padding: 3 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 34, borderRadius: radius.pill },
  segActive: { backgroundColor: colors.brand },
  segText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  segTextActive: { color: colors.onBrand },
  videoBox: { backgroundColor: '#000' },
  chatBox: { backgroundColor: '#0F0F0F', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  chatHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: '#101010' },
  chatHeadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  emptyText: { color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
