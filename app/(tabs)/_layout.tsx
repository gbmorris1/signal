import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '@/theme';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: 'pulse', off: 'pulse-outline' },
  discover: { on: 'compass', off: 'compass-outline' },
  watchlist: { on: 'star', off: 'star-outline' },
  alerts: { on: 'notifications', off: 'notifications-outline' },
  profile: { on: 'person-circle', off: 'person-circle-outline' },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenListeners={{
        tabPress: () => void Haptics.selectionAsync(),
      }}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        // Screen titles are mastheads: serif, like the publication it is.
        headerTitleStyle: { fontFamily: typography.title.fontFamily, fontSize: 17 },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.rule,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        // A 5-tab bar has no room to reflow at accessibility text sizes -
        // the label wraps/clips before the tab bar itself can grow. This is
        // the same call iOS's own Tab Bar effectively makes.
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: { ...typography.ticker, fontSize: 8.5 },
        tabBarIcon: ({ color, focused }) => {
          const icon = ICONS[route.name];
          return <Ionicons name={focused ? icon.on : icon.off} size={22} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
