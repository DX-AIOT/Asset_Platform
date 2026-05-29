import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { remindersApi } from './remindersApi';

const LAST_REGISTERED_PUSH_TOKEN_KEY = 'last_registered_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('maintenance-reminders', {
    name: 'Maintenance Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#007AFF',
  });
};

const requestDevicePushToken = async (): Promise<string | null> => {
  if (!Device.isDevice) return null;

  const permissionState = await Notifications.getPermissionsAsync();
  let finalStatus = permissionState.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenResponse = await Notifications.getDevicePushTokenAsync();
  return typeof tokenResponse.data === 'string' ? tokenResponse.data : null;
};

export const registerDeviceForPushNotifications = async (): Promise<void> => {
  try {
    await ensureAndroidChannel();
    const token = await requestDevicePushToken();

    if (!token) return;

    const lastToken = await SecureStore.getItemAsync(LAST_REGISTERED_PUSH_TOKEN_KEY);
    if (lastToken === token) return;

    await remindersApi.registerDeviceToken(token);
    await SecureStore.setItemAsync(LAST_REGISTERED_PUSH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Push registration failed:', error);
  }
};

export const createNotificationTapSubscription = (
  onItemReminderTap: (itemId: string) => void,
): Notifications.Subscription =>
  Notifications.addNotificationResponseReceivedListener((response) => {
    const itemId = response.notification.request.content.data?.itemId;
    if (typeof itemId === 'string' && itemId.length > 0) {
      onItemReminderTap(itemId);
    }
  });
