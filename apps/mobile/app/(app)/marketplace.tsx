import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { marketplaceApi } from '../../services/marketplaceApi';
import { Listing, ListingFilters } from '../../types/listing';
import { ItemCategory, ItemCondition, CATEGORY_LABELS } from '../../types/item';

const CONDITION_OPTIONS: { label: string; value: ItemCondition | undefined }[] = [
  { label: 'Any Condition', value: undefined },
  { label: 'New', value: ItemCondition.NEW },
  { label: 'Like New', value: ItemCondition.LIKE_NEW },
  { label: 'Good', value: ItemCondition.GOOD },
  { label: 'Fair', value: ItemCondition.FAIR },
  { label: 'Poor', value: ItemCondition.POOR },
];

const CATEGORY_OPTIONS: { label: string; value: ItemCategory | undefined }[] = [
  { label: 'All Categories', value: undefined },
  { label: 'Electronics', value: ItemCategory.ELECTRONICS },
  { label: 'Mobile Phones', value: ItemCategory.MOBILE_PHONES },
  { label: 'Laptops', value: ItemCategory.LAPTOPS },
  { label: 'Vehicles', value: ItemCategory.VEHICLES },
  { label: 'Furniture', value: ItemCategory.FURNITURE },
  { label: 'Appliances', value: ItemCategory.APPLIANCES },
  { label: 'Other', value: ItemCategory.OTHER },
];

const CONDITION_BADGE: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: '#34C759' },
  like_new: { label: 'Like New', color: '#30D158' },
  good: { label: 'Good', color: '#007AFF' },
  fair: { label: 'Fair', color: '#FF9500' },
  poor: { label: 'Poor', color: '#FF3B30' },
};

function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const badge = CONDITION_BADGE[listing.condition] ?? { label: listing.condition, color: '#999' };
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {listing.photos.length > 0 ? (
        <Image source={{ uri: listing.photos[0] }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Text style={styles.cardImagePlaceholderText}>📦</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={styles.cardCategory}>{CATEGORY_LABELS[listing.category]}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>${Number(listing.price).toLocaleString()}</Text>
          <View style={[styles.conditionBadge, { backgroundColor: badge.color + '22' }]}>
            <Text style={[styles.conditionBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function Marketplace() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | undefined>();
  const [selectedCondition, setSelectedCondition] = useState<ItemCondition | undefined>();

  const fetchListings = async (filters?: ListingFilters) => {
    try {
      const response = await marketplaceApi.getListings(filters);
      setListings(response.data.listings);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchListings({ q: searchText, category: selectedCategory, condition: selectedCondition });
  }, [searchText, selectedCategory, selectedCondition]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchListings({ q: searchText, category: selectedCategory, condition: selectedCondition });
  }, [searchText, selectedCategory, selectedCondition]);

  const applyFilters = () => {
    setShowFilter(false);
    fetchListings({ q: searchText, category: selectedCategory, condition: selectedCondition });
  };

  const clearFilters = () => {
    setSelectedCategory(undefined);
    setSelectedCondition(undefined);
    setShowFilter(false);
  };

  const activeFilterCount = [selectedCategory, selectedCondition].filter(Boolean).length;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search listings…"
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilter(true)}>
          <Text style={styles.filterIcon}>⚙</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🏪</Text>
          <Text style={styles.emptyText}>No listings found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => router.push(`/listing/${item.id}`)}
            />
          )}
        />
      )}

      <Modal visible={showFilter} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.filterSheet}>
          <View style={styles.filterHeader}>
            <TouchableOpacity onPress={() => setShowFilter(false)}>
              <Text style={styles.filterCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.filterTitle}>Filters</Text>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.filterClearText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterBody}>
            <Text style={styles.filterSectionLabel}>Category</Text>
            {CATEGORY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={styles.filterOption}
                onPress={() => setSelectedCategory(opt.value)}
              >
                <Text style={styles.filterOptionText}>{opt.label}</Text>
                {selectedCategory === opt.value && (
                  <Text style={styles.filterCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            <Text style={[styles.filterSectionLabel, { marginTop: 24 }]}>Condition</Text>
            {CONDITION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={styles.filterOption}
                onPress={() => setSelectedCondition(opt.value)}
              >
                <Text style={styles.filterOptionText}>{opt.label}</Text>
                {selectedCondition === opt.value && (
                  <Text style={styles.filterCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.filterFooter}>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchRow: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    gap: 12,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  clearIcon: {
    fontSize: 14,
    color: '#999',
    paddingHorizontal: 4,
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    fontSize: 20,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  listContent: {
    padding: 8,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImagePlaceholderText: {
    fontSize: 40,
  },
  cardContent: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  cardCategory: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  conditionBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  conditionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  filterSheet: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterCancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  filterTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  filterClearText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  filterBody: {
    flex: 1,
    padding: 16,
  },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#000',
  },
  filterCheckmark: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  filterFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
