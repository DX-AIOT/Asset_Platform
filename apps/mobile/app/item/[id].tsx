import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { itemsApi } from '../../services/itemsApi';
import { Item, CATEGORY_LABELS, PriceHistoryResponse, PriceHistoryPoint } from '../../types/item';

const { width } = Dimensions.get('window');

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

function buildSparkPoints(points: PriceHistoryPoint[]): number[] {
  return points.map((point) => Number(point.value));
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function Sparkline({ points }: { points: PriceHistoryPoint[] }) {
  const values = buildSparkPoints(points);
  if (values.length === 0) return null;

  const display = values.slice(-10);
  const min = Math.min(...display);
  const max = Math.max(...display);
  const range = max - min || 1;
  const BAR_HEIGHT = 40;
  const BAR_WIDTH = 8;
  const GAP = 3;

  return (
    <View style={styles.sparklineContainer}>
      {display.map((v, i) => (
        <View
          key={i}
          style={[
            styles.sparklineBar,
            {
              width: BAR_WIDTH,
              height: Math.max(3, ((v - min) / range) * BAR_HEIGHT),
              marginRight: i < display.length - 1 ? GAP : 0,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function ItemDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id as string;
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryResponse | null>(null);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItem();
    fetchPriceHistory();
  }, [id]);

  const fetchItem = async () => {
    try {
      const response = await itemsApi.getItemById(id);
      setItem(response.data);
    } catch (error) {
      console.error('Failed to fetch item:', error);
    } finally {
      setLoading(false);
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

  const trend30d = priceHistory?.trends ?? null;
  const trendColor =
    trend30d?.direction === 'up'
      ? '#34C759'
      : trend30d?.direction === 'down'
        ? '#FF3B30'
        : '#999';
  const trendArrow =
    trend30d?.direction === 'up' ? '↑' : trend30d?.direction === 'down' ? '↓' : '→';

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

          {item.purchaseDate && (
            <View style={styles.section}>
              <Text style={styles.label}>Purchase Date</Text>
              <Text style={styles.value}>{new Date(item.purchaseDate).toLocaleDateString()}</Text>
            </View>
          )}

          {item.warrantyExpiry && (
            <View style={styles.section}>
              <Text style={styles.label}>Warranty Expiry</Text>
              <Text style={styles.value}>
                {new Date(item.warrantyExpiry).toLocaleDateString()}
              </Text>
            </View>
          )}

          {item.notes && (
            <View style={styles.section}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.notes}>{item.notes}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.sellButton}
            onPress={() => router.push({ pathname: '/listing/new', params: { itemId: item.id } })}
          >
            <Text style={styles.sellButtonText}>🏷  Sell This Item</Text>
          </TouchableOpacity>
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
  priceHistoryCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  priceHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  latestValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  trendBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
  },
  sparklineBar: {
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  emptyHistory: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  sellButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sellButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
