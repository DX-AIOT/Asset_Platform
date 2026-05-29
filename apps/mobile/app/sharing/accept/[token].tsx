import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { sharingApi } from '../../../services/sharingApi';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Accepting invite...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accept = async () => {
      if (!token) {
        setError('Missing invite token.');
        setLoading(false);
        return;
      }

      try {
        const response = await sharingApi.acceptInvite(token);
        setMessage(response.data.message || 'Invite accepted.');
      } catch (e: any) {
        const serverMessage = e?.response?.data?.message;
        setError(Array.isArray(serverMessage) ? serverMessage.join('\n') : serverMessage || 'Invite could not be accepted.');
      } finally {
        setLoading(false);
      }
    };

    accept();
  }, [token]);

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.message}>Accepting invite...</Text>
        </>
      ) : (
        <>
          <Text style={[styles.message, error ? styles.error : styles.success]}>{error || message}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(app)/sharing')}>
            <Text style={styles.buttonText}>Go to Family Sharing</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  message: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  success: {
    color: '#1b6d29',
  },
  error: {
    color: '#b42318',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
