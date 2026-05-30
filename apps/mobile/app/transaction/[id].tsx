import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { transactionApi } from '../../services/transactionApi';
import type { Transaction, EscrowStatus } from '../../types/item';
import {
  ESCROW_STATUS_LABELS,
  ESCROW_STATUS_COLORS,
} from '../../types/item';

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function useCountdown(targetIso: string | undefined): number {
  const [remaining, setRemaining] = useState(() =>
    targetIso ? new Date(targetIso).getTime() - Date.now() : 0
  );

  useEffect(() => {
    if (!targetIso) return;
    const tick = () =>
      setRemaining(new Date(targetIso).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return remaining;
}

function EscrowStatusBadge({ status }: { status: EscrowStatus }) {
  const color = ESCROW_STATUS_COLORS[status];
  return (
    <View style={[badgeStyles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <View style={[badgeStyles.dot, { backgroundColor: color }]} />
      <Text style={[badgeStyles.label, { color }]}>
        {ESCROW_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default function TransactionStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const remaining = useCountdown(transaction?.escrowAutoReleaseAt);

  const fetchTransaction = useCallback(async () => {
    if (!id) return;
    try {
      const res = await transactionApi.findOne(id);
      setTransaction(res.data);
    } catch {
      setTransaction(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  const handleConfirmReceipt = () => {
    Alert.alert(
      'Confirm Receipt',
      'This will release the escrow payment to the seller. Are you sure you received the item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            if (!id) return;
            setConfirming(true);
            try {
              const res = await transactionApi.confirmReceipt(id);
              setTransaction(res.data);
              Alert.alert('Done', 'Payment released to seller.');
            } catch {
              Alert.alert('Error', 'Could not confirm receipt. Try again.');
            } finally {
              setConfirming(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Transaction not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isHeld = transaction.escrowStatus === 'HELD';
  const withinWindow = remaining > 0;
  const canDispute = isHeld && withinWindow;
  const canConfirm = isHeld;

  return (
    <>
      <Stack.Screen options={{ title: 'Transaction' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {transaction.listingTitle ?? `Transaction ${transaction.id.slice(0, 8)}`}
        </Text>

        {/* Amount */}
        <Text style={styles.amount}>
          {transaction.currency} {Number(transaction.amount).toLocaleString()}
        </Text>

        {/* Status badge */}
        <EscrowStatusBadge status={transaction.escrowStatus} />

        {/* 72h countdown (only while HELD) */}
        {isHeld && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>
              {withinWindow ? 'Auto-release in' : 'Window closed'}
            </Text>
            <Text style={[styles.timerValue, !withinWindow && styles.timerExpired]}>
              {formatCountdown(remaining)}
            </Text>
            <Text style={styles.timerSub}>
              Funds release automatically 72h after purchase if no dispute is filed
            </Text>
          </View>
        )}

        {/* Parties */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Parties</Text>
          {transaction.buyerName ? (
            <Text style={styles.partyRow}>Buyer: {transaction.buyerName}</Text>
          ) : null}
          {transaction.sellerName ? (
            <Text style={styles.partyRow}>Seller: {transaction.sellerName}</Text>
          ) : null}
        </View>

        {/* Dispute info (when disputed) */}
        {transaction.escrowStatus === 'DISPUTED' && transaction.disputeReason ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Dispute Details</Text>
            <Text style={styles.disputeReason}>{transaction.disputeReason}</Text>
            {transaction.disputeDescription ? (
              <Text style={styles.disputeDesc}>{transaction.disputeDescription}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Actions */}
        {canConfirm && (
          <TouchableOpacity
            style={[styles.primaryBtn, confirming && styles.btnDisabled]}
            onPress={handleConfirmReceipt}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Confirm Receipt</Text>
            )}
          </TouchableOpacity>
        )}

        {canDispute && (
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() =>
              router.push({
                pathname: '/transaction/dispute',
                params: { id: transaction.id },
              })
            }
          >
            <Text style={styles.disputeBtnText}>File Dispute</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#888',
  },
  backLink: {
    fontSize: 15,
    color: '#007AFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  amount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#007AFF',
  },
  timerCard: {
    backgroundColor: '#f2f2f7',
    borderRadius: 14,
    padding: 18,
    gap: 6,
    marginTop: 4,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111',
    fontVariant: ['tabular-nums'],
  },
  timerExpired: {
    color: '#FF3B30',
  },
  timerSub: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  partyRow: {
    fontSize: 15,
    color: '#333',
  },
  disputeReason: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9500',
  },
  disputeDesc: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: '#34C759',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  disputeBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF9500',
  },
  disputeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FF9500',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
