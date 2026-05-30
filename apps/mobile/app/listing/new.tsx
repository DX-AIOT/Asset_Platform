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
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { marketplaceApi } from '../../services/marketplaceApi';
import type { ListingCondition } from '../../types/listing';
import { CONDITION_LABELS } from '../../types/listing';

const CONDITIONS: ListingCondition[] = ['new', 'like_new', 'good', 'fair', 'poor'];

const CITIES = [
  'Bangkok',
  'Chiang Mai',
  'Phuket',
  'Pattaya',
  'Khon Kaen',
  'Hat Yai',
  'Nakhon Ratchasima',
  'Other',
];

export default function NewListing() {
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId: string }>();
  const itemId = Array.isArray(params.itemId) ? params.itemId[0] : params.itemId;

  const [autofillLoading, setAutofillLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(true);

  // form fields (pre-filled by autofill)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<ListingCondition>('good');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // price suggestion
  const [suggestion, setSuggestion] = useState<{
    suggestedPrice: number;
    priceRange: { low: number; high: number };
    rationale: string;
    currency: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    loadAutofill();
    loadPriceSuggestion();
  }, [itemId]);

  const loadAutofill = async () => {
    if (!itemId) return;
    try {
      const res = await marketplaceApi.getAutofill(itemId);
      const draft = res.data;
      setTitle(draft.title);
      setDescription(draft.description);
      setCondition((draft.condition as ListingCondition) || 'good');
      setPhotos(draft.photos ?? []);
      if (draft.location?.city) setCity(draft.location.city);
    } catch {
      // autofill optional — user can fill manually
    } finally {
      setAutofillLoading(false);
    }
  };

  const loadPriceSuggestion = async () => {
    if (!itemId) return;
    try {
      const res = await marketplaceApi.getPriceSuggestion(itemId, condition);
      setSuggestion(res.data);
    } catch {
      // price suggestion optional
    } finally {
      setPriceLoading(false);
    }
  };

  const handleUsePrice = () => {
    if (suggestion) {
      setPrice(suggestion.suggestedPrice.toFixed(2));
    }
  };

  const handleSubmit = async () => {
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.');
      return;
    }
    if (!condition) {
      Alert.alert('Missing condition', 'Please select the item condition.');
      return;
    }

    if (!itemId) {
      Alert.alert('Error', 'No item selected.');
      return;
    }

    setSubmitting(true);
    try {
      const createRes = await marketplaceApi.create({
        itemId,
        price: Number(price),
        condition,
        description: description || undefined,
        photos: photos.length > 0 ? photos : undefined,
        ...(city ? { location: { city } } : {}),
      });

      const listingId = createRes.data.id;

      // publish immediately
      await marketplaceApi.publish(listingId);

      Alert.alert('Listed!', 'Your item is now live on the marketplace.', [
        {
          text: 'View Listing',
          onPress: () =>
            router.replace({ pathname: '/listing/[id]', params: { id: listingId } }),
        },
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      Alert.alert(
        'Failed to list',
        err?.response?.data?.message ?? 'Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = autofillLoading && priceLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Preparing listing…</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sell This Item', headerBackTitle: 'Back' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Title (display only) */}
        {title ? (
          <View style={styles.titleBanner}>
            <Text style={styles.titleBannerLabel}>Item</Text>
            <Text style={styles.titleBannerValue}>{title}</Text>
          </View>
        ) : null}

        {/* AI Price Suggestion */}
        {suggestion ? (
          <View style={styles.suggestionCard}>
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionTitle}>AI Price Suggestion</Text>
              <Text style={styles.suggestionBadge}>Smart Pricing</Text>
            </View>
            <Text style={styles.suggestedPrice}>
              {suggestion.currency} {suggestion.suggestedPrice.toLocaleString()}
            </Text>
            <Text style={styles.priceRange}>
              Range: {suggestion.currency} {suggestion.priceRange.low.toLocaleString()} –{' '}
              {suggestion.priceRange.high.toLocaleString()}
            </Text>
            <Text style={styles.rationale} numberOfLines={3}>
              {suggestion.rationale}
            </Text>
            <TouchableOpacity style={styles.usePriceBtn} onPress={handleUsePrice}>
              <Text style={styles.usePriceBtnText}>Use This Price</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Price input */}
        <Text style={styles.label}>Your Price *</Text>
        <View style={styles.priceInputRow}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Condition */}
        <Text style={styles.label}>Condition *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CONDITIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, condition === c && styles.chipActive]}
              onPress={() => setCondition(c)}
            >
              <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>
                {CONDITION_LABELS[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe your item…"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* City */}
        <Text style={styles.label}>Location (City)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CITIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, city === c && styles.chipActive]}
              onPress={() => setCity(city === c ? '' : c)}
            >
              <Text style={[styles.chipText, city === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>List for Sale</Text>
          )}
        </TouchableOpacity>
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
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
  titleBanner: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  titleBannerLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleBannerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginTop: 2,
  },
  suggestionCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  suggestionBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  suggestedPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  priceRange: {
    fontSize: 13,
    color: '#3B82F6',
    marginBottom: 8,
  },
  rationale: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 12,
  },
  usePriceBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  usePriceBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },
  currencySymbol: {
    fontSize: 20,
    color: '#888',
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    height: 48,
    fontSize: 22,
    fontWeight: '600',
    color: '#111',
  },
  chipScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f2f2f7',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#444',
  },
  chipTextActive: {
    color: '#fff',
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fafafa',
    minHeight: 100,
  },
  submitBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
