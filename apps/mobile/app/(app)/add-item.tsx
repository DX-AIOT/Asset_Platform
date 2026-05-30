import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { itemsApi } from '../../services/itemsApi';
import { aiApi } from '../../services/aiApi';
import { CATEGORY_LABELS, ItemCategory, ItemCondition, LOCATION_OPTIONS } from '../../types/item';

const CONDITION_LABELS: Record<ItemCondition, string> = {
  [ItemCondition.NEW]: 'New',
  [ItemCondition.LIKE_NEW]: 'Like New',
  [ItemCondition.GOOD]: 'Good',
  [ItemCondition.FAIR]: 'Fair',
  [ItemCondition.POOR]: 'Poor',
};

const CONDITION_ORDER: ItemCondition[] = [
  ItemCondition.NEW,
  ItemCondition.LIKE_NEW,
  ItemCondition.GOOD,
  ItemCondition.FAIR,
  ItemCondition.POOR,
];

const mapAssessedToItemCondition = (
  assessed: 'excellent' | 'good' | 'fair' | 'poor',
): ItemCondition => {
  if (assessed === 'excellent') return ItemCondition.LIKE_NEW;
  if (assessed === 'good') return ItemCondition.GOOD;
  if (assessed === 'fair') return ItemCondition.FAIR;
  return ItemCondition.POOR;
};

export default function AddItem() {
  const router = useRouter();
  const { scannedBarcode, itemId } = useLocalSearchParams<{ scannedBarcode?: string; itemId?: string }>();
  const isEditMode = useMemo(() => Boolean(itemId), [itemId]);
  const [loading, setLoading] = useState(false);
  const [loadingItem, setLoadingItem] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    model: '',
    category: ItemCategory.OTHER,
    serial: '',
    purchaseDate: '',
    purchasePrice: '',
    condition: ItemCondition.GOOD,
    location: '',
    notes: '',
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentSummary, setAssessmentSummary] = useState<string | null>(null);
  const [assessmentNotes, setAssessmentNotes] = useState<string | null>(null);
  const [assessmentNeedsReview, setAssessmentNeedsReview] = useState(false);
  const [conditionTouched, setConditionTouched] = useState(false);

  const mapProductCategoryToItemCategory = (rawCategory: string): ItemCategory => {
    const normalized = rawCategory.toLowerCase();
    if (normalized.includes('audio')) return ItemCategory.ELECTRONICS;
    if (normalized.includes('computer') || normalized.includes('peripheral'))
      return ItemCategory.ELECTRONICS;
    return ItemCategory.OTHER;
  };

  useEffect(() => {
    if (!itemId) return;

    const loadItem = async () => {
      setLoadingItem(true);
      try {
        const response = await itemsApi.getItemById(itemId);
        const current = response.data;
        setFormData({
          name: current.name,
          brand: current.brand ?? '',
          model: current.model ?? '',
          category: current.category,
          serial: current.serial ?? '',
          purchaseDate: current.purchaseDate ?? '',
          purchasePrice: current.purchasePrice ? String(current.purchasePrice) : '',
          condition: current.condition,
          location: current.location ?? '',
          notes: current.notes ?? '',
        });
        setPhotos(current.photos ?? []);
      } catch {
        Alert.alert('Error', 'Failed to load item details.');
      } finally {
        setLoadingItem(false);
      }
    };

    void loadItem();
  }, [itemId]);

  useEffect(() => {
    const barcode = scannedBarcode?.trim();
    if (!barcode) return;

    const runLookup = async () => {
      setLookupLoading(true);

      try {
        const result = await aiApi.lookupBarcode(barcode);

        setFormData((current) => {
          if (!result.found || !result.product) {
            return {
              ...current,
              serial: result.barcode,
            };
          }

          return {
            ...current,
            name: current.name || result.product.name,
            brand: current.brand || result.product.brand,
            category:
              current.category === ItemCategory.OTHER
                ? mapProductCategoryToItemCategory(result.product.category)
                : current.category,
            serial: current.serial || result.product.barcode,
          };
        });

        if (!result.found) {
          Alert.alert(
            'Barcode saved',
            'No product info found. Barcode has been saved in Serial Number.'
          );
        }
      } catch {
        setFormData((current) => ({
          ...current,
          serial: current.serial || barcode,
        }));
        Alert.alert(
          'Lookup failed',
          'Could not fetch product info. Barcode was saved in Serial Number.'
        );
      } finally {
        setLookupLoading(false);
      }
    };

    void runLookup();
  }, [scannedBarcode]);

  useEffect(() => {
    const firstPhoto = photos[0];
    if (!firstPhoto || conditionTouched) return;

    const runConditionAssessment = async () => {
      setAssessmentLoading(true);
      try {
        const result = await aiApi.assessCondition(firstPhoto, itemId);
        const nextCondition = mapAssessedToItemCondition(result.condition);
        const confidencePercent = Math.round(result.confidence * 100);
        const requiresReview = result.fallbackSuggested || result.confidence === 0;
        if (!requiresReview) {
          setFormData((current) => ({ ...current, condition: nextCondition }));
        }
        setAssessmentNeedsReview(requiresReview);
        setAssessmentSummary(
          requiresReview
            ? `AI suggested ${CONDITION_LABELS[nextCondition]} (${confidencePercent}%). Please review manually.`
            : `AI suggested ${CONDITION_LABELS[nextCondition]} (${confidencePercent}%).`,
        );
        setAssessmentNotes(result.notes?.trim() ? result.notes.trim() : null);
      } catch {
        setAssessmentNeedsReview(false);
        setAssessmentNotes(null);
        setAssessmentSummary('Could not auto-assess condition. You can set it manually.');
      } finally {
        setAssessmentLoading(false);
      }
    };

    void runConditionAssessment();
  }, [photos, conditionTouched, itemId]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Camera and photo library permissions are needed to add photos.'
        );
        return false;
      }
    }
    return true;
  };

  const MAX_PHOTOS = 10;

  const pickImageFromCamera = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos per item.`);
      return;
    }
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((current) => {
        if (current.length >= MAX_PHOTOS) return current;
        return [...current, result.assets[0].uri];
      });
    }
  };

  const pickImageFromGallery = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos per item.`);
      return;
    }
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map((asset: ImagePicker.ImagePickerAsset) => asset.uri);
      setPhotos((current) => {
        const remaining = MAX_PHOTOS - current.length;
        return [...current, ...newPhotos.slice(0, remaining)];
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_: string, i: number) => i !== index));
  };

  const movePhoto = (index: number, direction: 'left' | 'right') => {
    setPhotos((current) => {
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
  };

  const reorderPhoto = (index: number, direction: 'left' | 'right') => {
    const next = direction === 'left' ? index - 1 : index + 1;
    if (next < 0 || next >= photos.length) return;
    setPhotos((prev) => {
      const updated = [...prev];
      [updated[index], updated[next]] = [updated[next], updated[index]];
      return updated;
    });
  };

  const showPhotoOptions = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: pickImageFromCamera },
      { text: 'Gallery', onPress: pickImageFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter item name');
      return;
    }

    setLoading(true);
    try {
      const itemData = {
        name: formData.name,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        category: formData.category,
        serial: formData.serial || undefined,
        purchaseDate: formData.purchaseDate || undefined,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
        condition: formData.condition,
        location: formData.location || undefined,
        notes: formData.notes || undefined,
        photos: photos.length > 0 ? photos : undefined,
      };

      if (itemId) {
        await itemsApi.update(itemId, itemData);
      } else {
        await itemsApi.create(itemData);
      }

      Alert.alert('Success', isEditMode ? 'Item updated successfully' : 'Item added successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', isEditMode ? 'Failed to update item' : 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  if (loadingItem) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Item' : 'Add Item'}</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          style={styles.saveButton}
          disabled={loading}
        >
          <Text style={[styles.saveButtonText, loading && styles.disabledText]}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.scanBarcodeButton}
            onPress={() =>
              router.push({
                pathname: '/(app)/camera',
                params: { mode: 'barcode' },
              })
            }
          >
            <Text style={styles.scanBarcodeText}>
              {lookupLoading ? 'Looking up barcode...' : 'Scan Barcode / QR'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Photos{photos.length > 0 ? ` (${photos.length}/${MAX_PHOTOS})` : ''}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
            {photos.map((uri: string, index: number) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri }} style={styles.photo} />
                <View style={styles.reorderControls}>
                  <TouchableOpacity
                    style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                    onPress={() => movePhoto(index, 'left')}
                    disabled={index === 0}
                  >
                    <Text style={styles.reorderButtonText}>←</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reorderButton,
                      index === photos.length - 1 && styles.reorderButtonDisabled,
                    ]}
                    onPress={() => movePhoto(index, 'right')}
                    disabled={index === photos.length - 1}
                  >
                    <Text style={styles.reorderButtonText}>→</Text>
                  </TouchableOpacity>
                </View>
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
                      index === photos.length - 1 && styles.reorderButtonDisabled,
                    ]}
                    onPress={() => reorderPhoto(index, 'right')}
                    disabled={index === photos.length - 1}
                  >
                    <Text style={styles.reorderButtonText}>▶</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity style={styles.addPhotoButton} onPress={showPhotoOptions}>
                <Text style={styles.addPhotoText}>+</Text>
                <Text style={styles.addPhotoLabel}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text: string) => setFormData({ ...formData, name: text })}
              placeholder="Enter item name"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              value={formData.brand}
              onChangeText={(text) => setFormData({ ...formData, brand: text })}
              placeholder="Enter brand"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              value={formData.model}
              onChangeText={(text) => setFormData({ ...formData, model: text })}
              placeholder="Enter model"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={styles.pickerText}>{CATEGORY_LABELS[formData.category]}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.pickerOptions}>
                {(Object.entries(CATEGORY_LABELS) as [ItemCategory, string][]).map(
                  ([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.pickerOption}
                      onPress={() => {
                        setFormData({ ...formData, category: key });
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{label}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Condition</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowConditionPicker(!showConditionPicker)}
            >
              <Text style={styles.pickerText}>{CONDITION_LABELS[formData.condition]}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            {showConditionPicker && (
              <View style={styles.pickerOptions}>
                {CONDITION_ORDER.map((condition) => (
                  <TouchableOpacity
                    key={condition}
                    style={styles.pickerOption}
                    onPress={() => {
                      setConditionTouched(true);
                      setFormData({ ...formData, condition });
                      setShowConditionPicker(false);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>{CONDITION_LABELS[condition]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {assessmentLoading ? <Text style={styles.hintText}>Assessing from first photo...</Text> : null}
            {assessmentSummary ? (
              <Text style={[styles.hintText, assessmentNeedsReview && styles.warningHintText]}>
                {assessmentSummary}
              </Text>
            ) : null}
            {assessmentNotes ? <Text style={styles.hintText}>Notes: {assessmentNotes}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Serial Number</Text>
            <TextInput
              style={styles.input}
              value={formData.serial}
              onChangeText={(text) => setFormData({ ...formData, serial: text })}
              placeholder="Enter serial number"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Purchase Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Purchase Date</Text>
            <TextInput
              style={styles.input}
              value={formData.purchaseDate}
              onChangeText={(text) => setFormData({ ...formData, purchaseDate: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Purchase Price</Text>
            <TextInput
              style={styles.input}
              value={formData.purchasePrice}
              onChangeText={(text) => setFormData({ ...formData, purchasePrice: text })}
              placeholder="Enter price"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          <View style={styles.inputGroup}>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowLocationPicker(!showLocationPicker)}
            >
              <Text style={[styles.pickerText, !formData.location && styles.placeholderText]}>
                {formData.location || 'Select location'}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            {showLocationPicker && (
              <View style={styles.pickerOptions}>
                {LOCATION_OPTIONS.map((location) => (
                  <TouchableOpacity
                    key={location}
                    style={styles.pickerOption}
                    onPress={() => {
                      setFormData({ ...formData, location });
                      setShowLocationPicker(false);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>{location}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            placeholder="Add any additional notes..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  warningHintText: {
    color: '#B45309',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scanBarcodeButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  scanBarcodeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
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
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  reorderControls: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reorderButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonDisabled: {
    opacity: 0.35,
  },
  reorderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  pickerText: {
    fontSize: 16,
    color: '#000',
  },
  placeholderText: {
    color: '#999',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#999',
  },
  pickerOptions: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#000',
  },
  hintText: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
