import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme';

// Lightweight text glyphs keep the scaffold dependency-free; swap for an icon set later.
const ICONS: Record<string, string> = {
  index: '◎',
  discover: '⌕',
  watchlist: '★',
  alerts: '◔',
  profile: '⦿',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneContainerStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 18 }}>{ICONS[route.name] ?? '•'}</Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
