import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Foreground presentation.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationService {
  requestPermissions(): Promise<boolean>;
  getPushToken(): Promise<string | null>;
  sendTestNotification(): Promise<void>;
}

/** Real Expo-push implementation used on device. */
class ExpoNotificationService implements NotificationService {
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) return false; // simulators can't get a real token
    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    return status === 'granted';
  }

  async getPushToken(): Promise<string | null> {
    if (!Device.isDevice) return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    try {
      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      return token.data;
    } catch {
      return null;
    }
  }

  async sendTestNotification(): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'AI detected a major market shift',
        body: 'Fed Cut moved from 42% to 51%. Reason: CPI report changed expectations.',
      },
      trigger: { seconds: 2, channelId: 'default' } as Notifications.TimeIntervalTriggerInput,
    });
  }
}

let instance: NotificationService | null = null;
export function getNotificationService(): NotificationService {
  if (!instance) instance = new ExpoNotificationService();
  return instance;
}
