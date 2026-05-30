import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { marketplaceApi } from '../../services/marketplaceApi';
import { itemsApi } from '../../services/itemsApi';
import { Item, ItemCategory, ItemCondition, CATEGORY_LABELS } from '../../types/item';
import { PriceSuggestion } from '../../types/listing';

const CONDITION_OPTIONS: { label: string; value: ItemCondition }[] = [
  { label: 'New', value: ItemCondition.NEW },
  { label: 'Like New', value: ItemCondition.LIKE_NEW },
  { label: 'Good', value: ItemCondition.GOOD },
  { label: 'Fair', value: ItemCondition.FAIR },
  { label: 'Poor', value: ItemCondition.POOR },
];

export default function NewListing() {
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId?: string }>();
  const itemId = params.itemId as string | undefined;

  const [sourceItem, setSourceItem] = useState<Item | null>(null);
  const [loadingItem, setLoadingItem] = useState(!!itemId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<ItemCondition>(ItemCondition.GOOD);
  const [category, setCategory] = useState<ItemCategory>(ItemCategory.OTHER);
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (itemId) {
      loadItemAndAutofill(itemId);
    }
  }, [itemId]);

  const loadItemAndAutofill = async (id: string) => {
    try {
      const response = await itemsApi.getItemById(id);
      const item = response.data;
      setSourceItem(item);
      setTitle(item.name);
      setCondition(item.condition);
      setCategory(item.category);
      if (item.notes) setDescription(item.notes);
      fetchPriceSuggestion(item);
    } catch (error) {
      console.error('Failed to load item:', error);
    } finally {
      setLoadingItem(false);
    }
  };

  const fetchPriceSuggestion = async (item: Item) => {
    setLoadingSuggestion(true);
    try {
      const response = await marketplaceApi.suggestPrice({
        name: item.name,
        category: item.category,
        condition: item.condition,
        brand: item.brand,
        model: item.model,
        purchasePrice: item.purchasePrice,
      });
      setPriceSuggestion(response.data);
    } catch (error) {
      console.error('Price suggestion failed:', error);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const useThisPrice = () => {
    if (priceSuggestion) {
      setPrice(String(priceSuggestion.suggestedPrice));
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for your listing.');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Required', 'Please enter a valid price.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await marketplaceApi.createListing({
        title: title.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
        condition,
        category,
        photos: sourceItem?.photos,
        itemId: sourceItem?.id,
      });
      Alert.alert('Listed!', 'Your item has been listed on the marketplace.', [
        {
          text: 'View Listing',
          onPress: () => {
            router.replace(`/listing/${response.data.id}`);
          },
        },
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create listing.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingItem) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading item details…</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'List for Sale', headerBackTitle: 'Back' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          {sourceItem && (
            <View style={styles.autofillBanner}>
              <Text style={styles.autofillIcon}>✨</Text>
              <Text style={styles.autofillText}>
                AI autofilled from <Text style={styles.autofillBold}>{sourceItem.name}</Text>
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. iPhone 14 Pro 256GB"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the item's condition, included accessories, etc."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Price *</Text>
            {loadingSuggestion && (
              <View style={styles.suggestionLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.suggestionLoadingText}>Getting price suggestion…</Text>
              </View>
            )}
            {priceSuggestion && !loadingSuggestion && (
              <View style={styles.suggestionCard}>
                <View style={styles.suggestionHeader}>
                  <Text style={styles.suggestionTitle}>AI Price Suggestion</Text>
                  <Text style={styles.suggestionConfidence}>
                    {Math.round(priceSuggestion.confidence * 100)}% confidence
                  </Text>
                </View>
                <Text style={styles.suggestionPrice}>
                  ${priceSuggestion.suggestedPrice.toLocaleString()}
                </Text>
                <Text style={styles.suggestionRange}>
                  Range: ${priceSuggestion.minPrice.toLocaleString()} –{' '}
                  ${priceSuggestion.maxPrice.toLocaleString()}
                </Text>
                {priceSuggestion.rationale ? (
                  <Text style={styles.suggestionRationale}>{priceSuggestion.rationale}</Text>
                ) : null}
                <TouchableOpacity style={styles.useThisPriceButton} onPress={useThisPrice}>
                  <Text style={styles.useThisPriceText}>Use This Price</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.priceInputRow}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={[styles.input, styles.priceInput]}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.chipRow}>
              {CONDITION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, condition === opt.value && styles.chipSelected]}
                  onPress={() => setCondition(opt.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      condition === opt.value && styles.chipTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {(Object.values(ItemCategory) as ItemCategory[]).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipSelected]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[styles.chipText, category === cat && styles.chipTextSelected]}
                  >
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>List for Sale</Text>
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
  contentContainer: {
    padding: 20,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  autofillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  autofillIcon: {
    fontSize: 20,
  },
  autofillText: {
    fontSize: 14,
    color: '#E65100',
    flex: 1,
  },
  autofillBold: {
    fontWeight: '600',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  suggestionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  suggestionLoadingText: {
    fontSize: 13,
    color: '#999',
  },
  suggestionCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CCE5FF',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  suggestionConfidence: {
    fontSize: 12,
    color: '#007AFF',
    opacity: 0.7,
  },
  suggestionPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 2,
  },
  suggestionRange: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
  suggestionRationale: {
    fontSize: 12,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  useThisPriceButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  useThisPriceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 20,
    color: '#333',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E8F0FE',
  },
  chipText: {
    fontSize: 14,
    color: '#555',
  },
  chipTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
