import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { transactionApi } from '../../services/transactionApi';
import type { Transaction, EscrowStatus } from '../../types/item';
import { ESCROW_STATUS_LABELS, ESCROW_STATUS_COLORS } from '../../types/item';

function StatusChip({ status }: { status: EscrowStatus }) {
  const color = ESCROW_STATUS_COLORS[status];
  const label = ESCROW_STATUS_LABELS[status];
  return (
    <View style={[chipStyles.chip, { backgroundColor: color + '22' }]}>
      <Text style={[chipStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

function TransactionRow({
  tx,
  onPress,
}: {
  tx: Transaction;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {tx.listingTitle ?? `Transaction ${tx.id.slice(0, 8)}`}
        </Text>
        <Text style={styles.rowAmount}>
          {tx.currency} {Number(tx.amount).toLocaleString()}
        </Text>
        <StatusChip status={tx.escrowStatus} />
      </View>
      <Text style={styles.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function MyTransactions() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setError(null);
      const res = await transactionApi.list();
      setTransactions(res.data);
    } catch {
      setError('Could not load transactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions();
  }, [fetchTransactions]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TransactionRow
            tx={item}
            onPress={() =>
              router.push({
                pathname: '/transaction/[id]',
                params: { id: item.id },
              })
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Completed purchases will appear here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: '#FF3B3022',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  listContent: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flex: 1,
    gap: 6,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
  },
  rowArrow: {
    fontSize: 22,
    color: '#ccc',
    marginLeft: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});
