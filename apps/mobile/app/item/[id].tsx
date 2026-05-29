import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { itemsApi } from '../../services/itemsApi';
import { remindersApi } from '../../services/remindersApi';
import { Item, CATEGORY_LABELS } from '../../types/item';
import { MaintenanceReminder } from '../../types/reminder';

const { width } = Dimensions.get('window');

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export default function ItemDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id as string;
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [title, setTitle] = useState('');
  const [intervalDays, setIntervalDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItem();
  }, [id]);

  const sortByDueAt = (list: MaintenanceReminder[]) =>
    [...list].sort(
      (a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime(),
    );

  const fetchItem = async () => {
    try {
      const [itemResponse, remindersResponse] = await Promise.all([
        itemsApi.getItemById(id),
        remindersApi.listByItem(id),
      ]);
      setItem(itemResponse.data);
      setReminders(sortByDueAt(remindersResponse.data));
    } catch (fetchError) {
      console.error('Failed to fetch item details:', fetchError);
    } finally {
      setLoading(false);
      setRemindersLoading(false);
    }
  };

  const handleCreateReminder = async () => {
    if (!title.trim()) {
      setError('Reminder title is required.');
      return;
    }

    const parsedInterval = Number(intervalDays);
    if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
      setError('Interval must be a whole number greater than 0.');
      return;
    }

    setSubmitLoading(true);
    setError(null);
    try {
      const response = await remindersApi.create(id, {
        title: title.trim(),
        intervalDays: parsedInterval,
        notes: notes.trim() || undefined,
      });
      setReminders((prev) => sortByDueAt([...prev, response.data]));
      setTitle('');
      setIntervalDays('30');
      setNotes('');
    } catch (createError) {
      console.error('Failed to create reminder:', createError);
      setError('Failed to schedule reminder. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleMarkDone = async (reminderId: string) => {
    setError(null);
    try {
      await remindersApi.complete(reminderId);
      const refreshed = await remindersApi.listByItem(id);
      setReminders(sortByDueAt(refreshed.data));
    } catch (completeError) {
      console.error('Failed to complete reminder:', completeError);
      setError('Failed to mark reminder done. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Item not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: item.name }} />
      <ScrollView style={styles.container}>
        {item.photos && item.photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.photoGallery}
          >
            {item.photos.map((photo: string, index: number) => (
              <Image
                key={index}
                source={{ uri: photo }}
                style={styles.photo}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>📦</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.name}>{item.name}</Text>
            {item.brand && <Text style={styles.brand}>{item.brand}</Text>}
          </View>

          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>{CATEGORY_LABELS[item.category]}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Condition</Text>
                <Text style={styles.infoValue}>
                  {CONDITION_LABELS[item.condition] || item.condition}
                </Text>
              </View>
            </View>
          </View>

          {item.model && (
            <View style={styles.section}>
              <Text style={styles.label}>Model</Text>
              <Text style={styles.value}>{item.model}</Text>
            </View>
          )}

          {item.serial && (
            <View style={styles.section}>
              <Text style={styles.label}>Serial Number</Text>
              <Text style={styles.value}>{item.serial}</Text>
            </View>
          )}

          {item.location && (
            <View style={styles.section}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{item.location}</Text>
            </View>
          )}

          {item.purchasePrice && (
            <View style={styles.section}>
              <Text style={styles.label}>Purchase Price</Text>
              <Text style={styles.priceValue}>${Number(item.purchasePrice).toLocaleString()}</Text>
            </View>
          )}

          {item.purchaseDate && (
            <View style={styles.section}>
              <Text style={styles.label}>Purchase Date</Text>
              <Text style={styles.value}>{new Date(item.purchaseDate).toLocaleDateString()}</Text>
            </View>
          )}

          {item.warrantyExpiry && (
            <View style={styles.section}>
              <Text style={styles.label}>Warranty Expiry</Text>
              <Text style={styles.value}>{new Date(item.warrantyExpiry).toLocaleDateString()}</Text>
            </View>
          )}

          {item.notes && (
            <View style={styles.section}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.notes}>{item.notes}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Maintenance Reminders</Text>
            {remindersLoading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : reminders.length === 0 ? (
              <Text style={styles.emptyText}>No reminders scheduled yet.</Text>
            ) : (
              reminders.map((reminder) => (
                <View key={reminder.id} style={styles.reminderCard}>
                  <View style={styles.reminderHeader}>
                    <View style={styles.reminderInfo}>
                      <Text style={styles.reminderTitle}>{reminder.title}</Text>
                      <Text style={styles.reminderMeta}>Every {reminder.intervalDays} day(s)</Text>
                      <Text style={styles.reminderMeta}>
                        Due {new Date(reminder.nextDueAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleMarkDone(reminder.id)}
                      style={styles.doneButton}
                    >
                      <Text style={styles.doneButtonText}>Mark Done</Text>
                    </Pressable>
                  </View>
                  {reminder.notes ? <Text style={styles.reminderNotes}>{reminder.notes}</Text> : null}
                </View>
              ))
            )}

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Schedule Reminder</Text>
              <TextInput
                style={styles.input}
                placeholder="Reminder title"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Interval in days (e.g. 30)"
                value={intervalDays}
                onChangeText={setIntervalDays}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                multiline
              />
              {error ? <Text style={styles.formError}>{error}</Text> : null}
              <Pressable
                onPress={handleCreateReminder}
                style={[styles.primaryButton, submitLoading && styles.buttonDisabled]}
                disabled={submitLoading}
              >
                <Text style={styles.primaryButtonText}>
                  {submitLoading ? 'Scheduling...' : 'Add Reminder'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  photoGallery: {
    height: 300,
  },
  photo: {
    width,
    height: 300,
  },
  photoPlaceholder: {
    width,
    height: 300,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 80,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  brand: {
    fontSize: 18,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  label: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  notes: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  reminderCard: {
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  reminderMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  reminderNotes: {
    marginTop: 8,
    color: '#444',
  },
  doneButton: {
    backgroundColor: '#0a7d3c',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  formCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  notesInput: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  formError: {
    color: '#b42318',
    fontSize: 13,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
