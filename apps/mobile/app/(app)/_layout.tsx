import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated]);

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
        name="marketplace"
        options={{
          title: 'Marketplace',
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
