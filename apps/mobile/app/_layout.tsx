import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="sharing/accept/[token]"
          options={{ headerShown: true, title: 'Accept Invite' }}
        />
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="item" options={{ headerShown: true }} />
        <Stack.Screen name="listing" options={{ headerShown: true }} />
      </Stack>
    </AuthProvider>
  );
}
