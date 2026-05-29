import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  createNotificationTapSubscription,
  registerDeviceForPushNotifications,
} from '../../services/notifications';

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    registerDeviceForPushNotifications();

    const tapSubscription = createNotificationTapSubscription((itemId) => {
      router.push({ pathname: '/item/[id]', params: { id: itemId } });
    });

    return () => {
      tapSubscription.remove();
    };
  }, [isAuthenticated, router]);

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Home',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="inventory"
        options={{
          title: 'My Assets',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="sharing"
        options={{
          title: 'Family Sharing',
        }}
      />
    </Stack>
  );
}
