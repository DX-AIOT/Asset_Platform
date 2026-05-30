import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome!</Text>
        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{user.email}</Text>
            {user.role && (
              <>
                <Text style={styles.label}>Role:</Text>
                <Text style={styles.value}>{user.role}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={() => router.push('/(app)/camera')}
          >
            <Text style={styles.actionButtonIcon}>📷</Text>
            <View style={styles.actionButtonContent}>
              <Text style={[styles.actionButtonTitle, styles.primaryActionButtonTitle]}>
                Scan New Asset
              </Text>
              <Text style={styles.actionButtonSubtitle}>AI recognition in &lt;3s</Text>
            </View>
            <Text style={styles.actionButtonArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/inventory')}
          >
            <Text style={styles.actionButtonIcon}>📦</Text>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonTitle}>My Assets</Text>
              <Text style={styles.actionButtonSubtitle}>View your inventory</Text>
            </View>
            <Text style={styles.actionButtonArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/sharing')}
          >
            <Text style={styles.actionButtonIcon}>👥</Text>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonTitle}>Family Sharing</Text>
              <Text style={styles.actionButtonSubtitle}>Invite and access shared inventories</Text>
            </View>
            <Text style={styles.actionButtonArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/add-item')}
          >
            <Text style={styles.actionButtonIcon}>➕</Text>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonTitle}>Add Item Manually</Text>
              <Text style={styles.actionButtonSubtitle}>When AI doesn't recognize</Text>
            </View>
            <Text style={styles.actionButtonArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/marketplace')}
          >
            <Text style={styles.actionButtonIcon}>🛍️</Text>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonTitle}>Marketplace</Text>
              <Text style={styles.actionButtonSubtitle}>Buy and sell with AI pricing</Text>
            </View>
            <Text style={styles.actionButtonArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(app)/transactions')}
          >
            <Text style={styles.actionButtonIcon}>🧾</Text>
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonTitle}>My Transactions</Text>
              <Text style={styles.actionButtonSubtitle}>Track escrow &amp; disputes</Text>
            </View>
            <Text style={styles.actionButtonArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featureList}>
            <Text style={styles.feature}>✓ AI-Powered Asset Scanning</Text>
            <Text style={styles.feature}>✓ Smart Category Detection</Text>
            <Text style={styles.feature}>📍 Location Tracking (Coming Soon)</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 24,
  },
  userInfo: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  featureList: {
    gap: 12,
  },
  feature: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionButtonIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionButtonArrow: {
    fontSize: 24,
    color: '#999',
  },
  primaryActionButton: {
    backgroundColor: '#007AFF',
  },
  primaryActionButtonTitle: {
    color: '#fff',
  },
  marketplaceActionButton: {
    backgroundColor: '#F59E0B',
  },
  marketplaceActionButtonTitle: {
    color: '#fff',
  },
});
