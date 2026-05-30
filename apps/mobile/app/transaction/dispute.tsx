import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { transactionApi } from '../../services/transactionApi';
import type { DisputeReason } from '../../types/item';
import { DISPUTE_REASONS } from '../../types/item';

const MAX_DESC_LENGTH = 500;

export default function FileDispute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = reason !== null && !submitting;

  const handleSubmit = async () => {
    if (!reason || !id) return;
    setSubmitting(true);
    try {
      await transactionApi.fileDispute(id, { reason, description: description.trim() });
      setSubmitted(true);
    } catch {
      Alert.alert('Error', 'Could not file dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <Stack.Screen options={{ title: 'File Dispute' }} />
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Dispute Filed</Text>
          <Text style={styles.successBody}>
            Our team will review your dispute and get back to you within 24 hours.
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'File Dispute' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>What went wrong?</Text>
          <Text style={styles.subheading}>
            Select the reason that best describes your issue.
          </Text>

          <View style={styles.reasonList}>
            {DISPUTE_REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonOption, reason === r && styles.reasonOptionSelected]}
                onPress={() => setReason(r)}
                activeOpacity={0.7}
              >
                <View style={[styles.radio, reason === r && styles.radioSelected]}>
                  {reason === r && <View style={styles.radioDot} />}
                </View>
                <Text
                  style={[
                    styles.reasonText,
                    reason === r && styles.reasonTextSelected,
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.descLabel}>
            Additional details{' '}
            <Text style={styles.descOptional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.descInput}
            placeholder="Describe what happened…"
            placeholderTextColor="#bbb"
            value={description}
            onChangeText={(t) =>
              setDescription(t.slice(0, MAX_DESC_LENGTH))
            }
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={MAX_DESC_LENGTH}
          />
          <Text style={styles.charCount}>
            {description.length}/{MAX_DESC_LENGTH}
          </Text>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Dispute</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 15,
    color: '#666',
    lineHeight: 21,
    marginBottom: 4,
  },
  reasonList: {
    gap: 8,
    marginVertical: 4,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 12,
  },
  reasonOptionSelected: {
    borderColor: '#FF9500',
    backgroundColor: '#FF950011',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#FF9500',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF9500',
  },
  reasonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  reasonTextSelected: {
    color: '#FF9500',
    fontWeight: '600',
  },
  descLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  descOptional: {
    fontWeight: '400',
    color: '#999',
  },
  descInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  charCount: {
    fontSize: 12,
    color: '#bbb',
    textAlign: 'right',
    marginTop: -4,
  },
  submitBtn: {
    backgroundColor: '#FF9500',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: '#fff',
  },
  successIcon: {
    fontSize: 72,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
  },
  successBody: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  doneBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});
