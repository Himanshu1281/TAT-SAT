import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: 'Home',
        tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="meditation" options={{
        title: 'Meditate',
        tabBarIcon: ({ color, size }) => <Ionicons name="leaf-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="diary" options={{
        title: 'Diary',
        tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="satsang" options={{
        title: 'Satsang',
        tabBarIcon: ({ color, size }) => <Ionicons name="videocam-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
