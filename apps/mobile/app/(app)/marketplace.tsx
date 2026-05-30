import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { marketplaceApi } from '../../services/marketplaceApi';
import type { Listing, ListingCondition, BrowseListingsQuery } from '../../types/listing';
import { CONDITION_LABELS, CONDITION_COLORS } from '../../types/listing';
import { ItemCategory, CATEGORY_LABELS } from '../../types/item';

const CONDITIONS: ListingCondition[] = ['new', 'like_new', 'good', 'fair', 'poor'];
const CATEGORY_OPTIONS = Object.values(ItemCategory);

function timeSince(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const mainPhoto = listing.photos[0];
  const condColor = CONDITION_COLORS[listing.condition] ?? '#007AFF';
  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.85}>
      {mainPhoto ? (
        <Image source={{ uri: mainPhoto }} style={cardStyles.photo} resizeMode="cover" />
      ) : (
        <View style={[cardStyles.photo, cardStyles.photoPlaceholder]}>
          <Text style={cardStyles.photoPlaceholderText}>No photo</Text>
        </View>
      )}
      <View style={cardStyles.info}>
        <Text style={cardStyles.title} numberOfLines={1}>
          {listing.title ?? listing.description?.split('\n')[0] ?? 'Listing'}
        </Text>
        <Text style={cardStyles.price}>
          {listing.currency} {Number(listing.price).toLocaleString()}
        </Text>
        <View style={cardStyles.metaRow}>
          <View style={[cardStyles.condBadge, { backgroundColor: condColor + '22' }]}>
            <Text style={[cardStyles.condText, { color: condColor }]}>
              {CONDITION_LABELS[listing.condition]}
            </Text>
          </View>
          {listing.city ? (
            <Text style={cardStyles.city}>{listing.city}</Text>
          ) : null}
          <Text style={cardStyles.time}>{timeSince(listing.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  photo: {
    width: 96,
    height: 96,
  },
  photoPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: '#bbb',
    fontSize: 11,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  condBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  condText: {
    fontSize: 11,
    fontWeight: '600',
  },
  city: {
    fontSize: 12,
    color: '#666',
  },
  time: {
    fontSize: 12,
    color: '#aaa',
    marginLeft: 'auto',
  },
});

export default function Marketplace() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);

  // filter state
  const [filterCondition, setFilterCondition] = useState<ListingCondition | undefined>();
  const [filterCategory, setFilterCategory] = useState<string | undefined>();
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');

  // pending (applied) filters
  const [appliedFilter, setAppliedFilter] = useState<BrowseListingsQuery>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchListings = useCallback(async (query: BrowseListingsQuery) => {
    try {
      const res = await marketplaceApi.browse(query);
      setListings(res.data.listings);
    } catch {
      Alert.alert('Error', 'Could not load marketplace listings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchListings(appliedFilter);
  }, [appliedFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchListings(appliedFilter);
  }, [appliedFilter, fetchListings]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setAppliedFilter((f) => ({ ...f, q: text || undefined, page: 1 }));
    }, 400);
  };

  const applyFilters = () => {
    const q: BrowseListingsQuery = {
      ...(search ? { q: search } : {}),
      ...(filterCondition ? { condition: filterCondition } : {}),
      ...(filterCategory ? { category: filterCategory } : {}),
      ...(filterPriceMin ? { priceMin: Number(filterPriceMin) } : {}),
      ...(filterPriceMax ? { priceMax: Number(filterPriceMax) } : {}),
      page: 1,
    };
    setAppliedFilter(q);
    setFilterVisible(false);
  };

  const clearFilters = () => {
    setFilterCondition(undefined);
    setFilterCategory(undefined);
    setFilterPriceMin('');
    setFilterPriceMax('');
    setAppliedFilter(search ? { q: search } : {});
    setFilterVisible(false);
  };

  const hasActiveFilters =
    !!filterCondition || !!filterCategory || !!filterPriceMin || !!filterPriceMax;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search listings…"
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={() => setFilterVisible(true)}
        >
          <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>
            Filters{hasActiveFilters ? ' •' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={listings}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No listings found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          </View>
        }
      />

      {/* Filter Sheet */}
      <Modal
        visible={filterVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        />
        <View style={styles.filterSheet}>
          <View style={styles.filterHandle} />
          <Text style={styles.filterTitle}>Filters</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.filterLabel}>Condition</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, filterCondition === c && styles.chipActive]}
                  onPress={() => setFilterCondition(filterCondition === c ? undefined : c)}
                >
                  <Text style={[styles.chipText, filterCondition === c && styles.chipTextActive]}>
                    {CONDITION_LABELS[c]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {CATEGORY_OPTIONS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, filterCategory === cat && styles.chipActive]}
                  onPress={() => setFilterCategory(filterCategory === cat ? undefined : cat)}
                >
                  <Text style={[styles.chipText, filterCategory === cat && styles.chipTextActive]}>
                    {CATEGORY_LABELS[cat as ItemCategory]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>Price Range</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                value={filterPriceMin}
                onChangeText={setFilterPriceMin}
                keyboardType="numeric"
              />
              <Text style={styles.priceSep}>–</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={filterPriceMax}
                onChangeText={setFilterPriceMax}
                keyboardType="numeric"
              />
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Apply</Text>
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
    backgroundColor: '#f8f8f8',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f2f2f7',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f2f2f7',
  },
  filterBtnActive: {
    backgroundColor: '#007AFF',
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  // modal / filter sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  filterSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  filterHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f2f2f7',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#444',
  },
  chipTextActive: {
    color: '#fff',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  priceSep: {
    fontSize: 16,
    color: '#888',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  clearBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  clearBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  applyBtn: {
    flex: 2,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
