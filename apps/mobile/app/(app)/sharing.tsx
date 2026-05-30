import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ShareMember, SharedInventory, sharingApi } from '../../services/sharingApi';

type Section = 'invite' | 'shared';

export default function SharingScreen() {
  const [activeSection, setActiveSection] = useState<Section>('invite');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [members, setMembers] = useState<ShareMember[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [membersResponse, sharedResponse] = await Promise.all([
        sharingApi.listMembers(),
        sharingApi.listSharedWithMe(),
      ]);
      setMembers(membersResponse.data);
      setSharedWithMe(sharedResponse.data);
    } catch (error) {
      console.error('Failed to fetch sharing data', error);
      Alert.alert('Error', 'Could not load family sharing data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const canInvite = useMemo(() => email.trim().length > 0 && !submitting, [email, submitting]);

  const handleInvite = async () => {
    const candidate = email.trim().toLowerCase();
    if (!candidate.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await sharingApi.invite(candidate);
      setEmail('');
      Alert.alert('Invite sent', `Invitation sent to ${candidate}`);
      await fetchData();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Unable to send invite. Please try again.';
      Alert.alert('Invite failed', Array.isArray(message) ? message.join('\n') : String(message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (member: ShareMember) => {
    if (!member.userId) {
      Alert.alert('Not available', 'Only accepted shares can be revoked in-app right now.');
      return;
    }

    Alert.alert('Revoke access', `Remove ${member.email} from your shared inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await sharingApi.revokeMember(member.userId!);
            await fetchData();
          } catch (error) {
            Alert.alert('Failed', 'Could not revoke access.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, activeSection === 'invite' && styles.toggleButtonActive]}
          onPress={() => setActiveSection('invite')}
        >
          <Text style={[styles.toggleText, activeSection === 'invite' && styles.toggleTextActive]}>Invite</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, activeSection === 'shared' && styles.toggleButtonActive]}
          onPress={() => setActiveSection('shared')}
        >
          <Text style={[styles.toggleText, activeSection === 'shared' && styles.toggleTextActive]}>Shared With Me</Text>
        </TouchableOpacity>
      </View>

      {activeSection === 'invite' ? (
        <View style={styles.sectionBody}>
          <Text style={styles.label}>Invite by email</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity
            style={[styles.ctaButton, !canInvite && styles.ctaButtonDisabled]}
            disabled={!canInvite}
            onPress={handleInvite}
          >
            <Text style={styles.ctaButtonText}>{submitting ? 'Sending...' : 'Send Invite'}</Text>
          </TouchableOpacity>

          <Text style={styles.listTitle}>People with access</Text>
          <FlatList
            data={members}
            keyExtractor={(item) => `${item.email}-${item.sharedAt}`}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<Text style={styles.emptyText}>No invites sent yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.email}</Text>
                  <Text style={styles.badge}>{item.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.cardMeta}>Permission: {item.permission}</Text>
                <Text style={styles.cardMeta}>Shared: {new Date(item.sharedAt).toLocaleDateString()}</Text>
                {item.status === 'active' && item.userId ? (
                  <TouchableOpacity style={styles.linkButton} onPress={() => handleRevoke(item)}>
                    <Text style={styles.linkButtonText}>Revoke</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          />
        </View>
      ) : (
        <FlatList
          style={styles.sectionBody}
          data={sharedWithMe}
          keyExtractor={(item) => item.shareId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No one has shared an inventory with you yet.</Text>
          }
          renderItem={({ item }) => {
            const ownerName = [item.ownerFirstName, item.ownerLastName].filter(Boolean).join(' ') || item.ownerEmail;
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{ownerName}</Text>
                <Text style={styles.cardMeta}>Permission: {item.permission}</Text>
                <Text style={styles.cardMeta}>Since: {new Date(item.sharedAt).toLocaleDateString()}</Text>
                <Text style={styles.cardHint}>Shared inventory view is enabled. Item-level browse requires shared-items API support.</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionToggle: {
    flexDirection: 'row',
    backgroundColor: '#e9e9eb',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#fff',
  },
  toggleText: {
    color: '#4d4d4d',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#111',
  },
  sectionBody: {
    flex: 1,
  },
  label: {
    color: '#333',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  ctaButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 18,
  },
  ctaButtonDisabled: {
    backgroundColor: '#9cc9ff',
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3a3a3a',
    backgroundColor: '#efefef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  cardMeta: {
    color: '#4d4d4d',
    fontSize: 13,
    marginBottom: 4,
  },
  cardHint: {
    marginTop: 6,
    color: '#6a6a6a',
    fontSize: 12,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 28,
  },
  linkButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    color: '#d11a2a',
    fontWeight: '700',
  },
});
