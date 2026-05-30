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
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { itemsApi } from '../../services/itemsApi';
import { remindersApi } from '../../services/remindersApi';
import { Item, CATEGORY_LABELS, PriceHistoryPoint, PriceHistoryResponse, TrendWindow } from '../../types/item';
import { MaintenanceReminder } from '../../types/reminder';

const { width } = Dimensions.get('window');

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

const SPARKLINE_HEIGHT = 76;
const SPARKLINE_WIDTH = width - 88;

const getTrendArrow = (direction: TrendWindow['direction']): string => {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  return '→';
};

const getTrendColor = (direction: TrendWindow['direction']): string => {
  if (direction === 'up') return '#0a7d3c';
  if (direction === 'down') return '#b42318';
  return '#666';
};

const formatPercent = (value: number): string => {
  const rounded = Math.abs(value).toFixed(1);
  return `${value >= 0 ? '+' : '-'}${rounded}%`;
};

const buildSparkPoints = (points: PriceHistoryPoint[]) => {
  if (points.length < 2) return [];

  const values = points.map((point) => Number(point.estimatedValue));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const denominator = max - min || 1;
  const gap = SPARKLINE_WIDTH / (points.length - 1);

  return points.map((point, index) => {
    const x = index * gap;
    const normalizedY = (Number(point.estimatedValue) - min) / denominator;
    const y = SPARKLINE_HEIGHT - normalizedY * SPARKLINE_HEIGHT;
    return { x, y };
  });
};

export default function ItemDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id as string;
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryResponse | null>(null);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [intervalDays, setIntervalDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItem();
    fetchPriceHistory();
  }, [id]);

  const sortByDueAt = (list: MaintenanceReminder[]) =>
    [...list].sort(
      (a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime(),
    );

  const fetchItem = async () => {
    try {
      const [itemResponse, remindersResponse, priceHistoryResponse] = await Promise.all([
        itemsApi.getItemById(id),
        remindersApi.listByItem(id),
        itemsApi.getPriceHistory(id),
      ]);
      setItem(itemResponse.data);
      setReminders(sortByDueAt(remindersResponse.data));
      setPriceHistory(priceHistoryResponse.data);
    } catch (fetchError) {
      console.error('Failed to fetch item details:', fetchError);
    } finally {
      setLoading(false);
      setRemindersLoading(false);
      setPriceHistoryLoading(false);
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

  const fetchPriceHistory = async () => {
    try {
      const response = await itemsApi.getPriceHistory(id);
      setPriceHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch price history:', error);
    } finally {
      setPriceHistoryLoading(false);
    }
  };

  const enterEditMode = () => {
    setEditPhotos([...(item?.photos ?? [])]);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditPhotos([]);
  };

  const savePhotos = async () => {
    setSaving(true);
    try {
      await itemsApi.update(id, { photos: editPhotos });
      setItem((prev) => (prev ? { ...prev, photos: editPhotos } : prev));
      setEditMode(false);
      setEditPhotos([]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save photos');
    } finally {
      setSaving(false);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
        Alert.alert('Permissions Required', 'Camera and photo library access are needed.');
        return false;
      }
    }
    return true;
  };

  const pickFromCamera = async () => {
    const ok = await requestPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setEditPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const pickFromGallery = async () => {
    const ok = await requestPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setEditPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const showAddPhotoOptions = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (index: number) => {
    setEditPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const reorderPhoto = (index: number, direction: 'left' | 'right') => {
    const next = direction === 'left' ? index - 1 : index + 1;
    if (next < 0 || next >= editPhotos.length) return;
    setEditPhotos((prev) => {
      const updated = [...prev];
      [updated[index], updated[next]] = [updated[next], updated[index]];
      return updated;
    });
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

  const trend30d = priceHistory?.trends.find((trend) => trend.windowDays === 30);
  const sparkPoints = buildSparkPoints(priceHistory?.points ?? []);
  const hasPriceData = Boolean(
    priceHistory &&
    priceHistory.latestValue !== null &&
    priceHistory.points.length > 0,
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: editMode ? 'Edit Photos' : item.name,
          headerLeft: editMode
            ? () => (
                <TouchableOpacity onPress={cancelEdit} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>Cancel</Text>
                </TouchableOpacity>
              )
            : undefined,
          headerRight: () =>
            editMode ? (
              <TouchableOpacity
                onPress={savePhotos}
                disabled={saving}
                style={styles.headerButton}
              >
                <Text
                  style={[
                    styles.headerButtonText,
                    styles.headerButtonBold,
                    saving && styles.disabledText,
                  ]}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={enterEditMode} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Edit Photos</Text>
              </TouchableOpacity>
            ),
        }}
      />
      <ScrollView style={styles.container}>
        {editMode ? (
          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>Photos</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosContainer}
            >
              {editPhotos.map((uri, index) => (
                <View key={index} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.editPhoto} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Text style={styles.removePhotoText}>×</Text>
                  </TouchableOpacity>
                  <View style={styles.reorderRow}>
                    <TouchableOpacity
                      style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                      onPress={() => reorderPhoto(index, 'left')}
                      disabled={index === 0}
                    >
                      <Text style={styles.reorderButtonText}>◀</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.reorderButton,
                        index === editPhotos.length - 1 && styles.reorderButtonDisabled,
                      ]}
                      onPress={() => reorderPhoto(index, 'right')}
                      disabled={index === editPhotos.length - 1}
                    >
                      <Text style={styles.reorderButtonText}>▶</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.addPhotoButton} onPress={showAddPhotoOptions}>
                <Text style={styles.addPhotoText}>+</Text>
                <Text style={styles.addPhotoLabel}>Add Photo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : item.photos && item.photos.length > 0 ? (
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
            <View style={styles.itemActions}>
              <Pressable
                style={styles.editButton}
                onPress={() => router.push({ pathname: '/(app)/add-item', params: { itemId: id } })}
              >
                <Text style={styles.editButtonText}>Edit Item</Text>
              </Pressable>
              <Pressable
                style={styles.sellButton}
                onPress={() => router.push({ pathname: '/listing/new', params: { itemId: id } })}
              >
                <Text style={styles.sellButtonText}>Sell This Item</Text>
              </Pressable>
            </View>
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

          {/* Price History Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Price History</Text>
            {priceHistoryLoading ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 8 }} />
            ) : priceHistory && priceHistory.points.length > 0 ? (
              <View style={styles.priceHistoryCard}>
                <View style={styles.priceHistoryHeader}>
                  {priceHistory.latestValue !== null && (
                    <Text style={styles.latestValue}>
                      ${Number(priceHistory.latestValue).toLocaleString()}
                    </Text>
                  )}
                  {trend30d && (
                    <Text style={[styles.trendBadge, { color: trendColor }]}>
                      {trendArrow} {formatPercent(trend30d.changePercent)} 30d
                    </Text>
                  )}
                </View>
                <Sparkline points={priceHistory.points} />
              </View>
            ) : (
              <Text style={styles.emptyHistory}>No price history yet.</Text>
            )}
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Trend</Text>
            {priceHistoryLoading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : !hasPriceData ? (
              <Text style={styles.emptyText}>No price history yet.</Text>
            ) : (
              <View style={styles.chartCard}>
                <Text style={styles.latestValue}>
                  ${Number(priceHistory?.latestValue ?? 0).toLocaleString()}
                </Text>
                <Text style={styles.latestValueLabel}>Latest estimated value</Text>

                <View style={styles.sparkline}>
                  {sparkPoints.map((point, index) => {
                    if (index === 0) return null;
                    const prev = sparkPoints[index - 1];
                    const deltaX = point.x - prev.x;
                    const deltaY = point.y - prev.y;
                    const segmentLength = Math.sqrt(deltaX ** 2 + deltaY ** 2);
                    const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

                    return (
                      <View
                        key={`${point.x}-${point.y}`}
                        style={[
                          styles.sparkSegment,
                          {
                            width: segmentLength,
                            left: prev.x,
                            top: prev.y,
                            transform: [{ rotate: `${angle}deg` }],
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                {trend30d ? (
                  <View style={styles.trendRow}>
                    <Text style={[styles.trendArrow, { color: getTrendColor(trend30d.direction) }]}>
                      {getTrendArrow(trend30d.direction)}
                    </Text>
                    <Text style={[styles.trendValue, { color: getTrendColor(trend30d.direction) }]}>
                      {formatPercent(trend30d.percentChange)}
                    </Text>
                    <Text style={styles.trendWindow}>30d</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>30-day trend unavailable.</Text>
                )}
              </View>
            )}
          </View>

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
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerButtonBold: {
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
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
  editSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  editSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  photosContainer: {
    flexDirection: 'row',
  },
  photoWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  editPhoto: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reorderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  reorderButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 1,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  reorderButtonText: {
    fontSize: 12,
    color: '#333',
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 32,
    color: '#007AFF',
  },
  addPhotoLabel: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
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
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  editButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 13,
  },
  sellButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sellButtonText: {
    color: '#92400e',
    fontWeight: '600',
    fontSize: 13,
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
  latestValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
  },
  latestValueLabel: {
    marginTop: 2,
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  chartCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fcfcfc',
  },
  sparkline: {
    height: SPARKLINE_HEIGHT,
    width: SPARKLINE_WIDTH,
    backgroundColor: '#f4f7fb',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  sparkSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#007AFF',
  },
  trendRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendArrow: {
    fontSize: 16,
    fontWeight: '700',
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  trendWindow: {
    fontSize: 13,
    color: '#666',
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
