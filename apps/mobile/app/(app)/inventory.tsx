import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ItemCard } from '../../components/ItemCard';
import { itemsApi } from '../../services/itemsApi';
import { Item, ItemCategory } from '../../types/item';

const CATEGORY_OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Electronics', value: ItemCategory.ELECTRONICS },
  { label: 'Mobile Phones', value: ItemCategory.MOBILE_PHONES },
  { label: 'Laptops', value: ItemCategory.LAPTOPS },
  { label: 'Vehicles', value: ItemCategory.VEHICLES },
  { label: 'Furniture', value: ItemCategory.FURNITURE },
  { label: 'Appliances', value: ItemCategory.APPLIANCES },
  { label: 'Other', value: ItemCategory.OTHER },
];

export default function Inventory() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | undefined>();
  const [totalValue, setTotalValue] = useState<number>(0);

  const fetchItems = async () => {
    try {
      const [itemsResponse, valueResponse] = await Promise.all([
        itemsApi.getMyItems({ category: selectedCategory }),
        itemsApi.getTotalValue(),
      ]);

      setItems(itemsResponse.data.items);
      setTotalValue(valueResponse.data.total);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchItems();
  }, [selectedCategory]);

  const handleItemPress = (itemId: string) => {
    router.push(`/item/${itemId}`);
  };

  const handleCategoryPress = (category: ItemCategory | undefined) => {
    setSelectedCategory(category);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Assets</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.valueLabel}>Total Value</Text>
          <Text style={styles.valueAmount}>${totalValue.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.label}
            style={[
              styles.filterButton,
              selectedCategory === option.value && styles.filterButtonActive,
            ]}
            onPress={() => handleCategoryPress(option.value)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedCategory === option.value && styles.filterButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(item: Item) => item.id}
        renderItem={({ item }: { item: Item }) => (
          <ItemCard item={item} onPress={() => handleItemPress(item.id)} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubtext}>
              Add your first item to get started
            </Text>
          </View>
        }
      />
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  valueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  valueLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  valueAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterContent: {
    padding: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
});
