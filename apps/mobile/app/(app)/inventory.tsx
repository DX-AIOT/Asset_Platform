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
  Alert,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { ItemCard } from '../../components/ItemCard';
import { itemsApi } from '../../services/itemsApi';
import { reportsApi } from '../../services/reportsApi';
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
  const [exportingReport, setExportingReport] = useState(false);

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

  const handleExportInsuranceReport = async (): Promise<void> => {
    try {
      setExportingReport(true);
      const categoryIds = selectedCategory ? [selectedCategory] : undefined;
      const response = await reportsApi.generateInsurancePdf(categoryIds);
      const base64 = Buffer.from(response.data).toString('base64');

      const fileName = `insurance-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Share.share({
        title: 'Insurance Report',
        message: 'Insurance report PDF is ready.',
        url: fileUri,
      });
    } catch (error) {
      console.error('Failed to export insurance report:', error);
      Alert.alert('Export failed', 'Could not generate insurance report. Please try again.');
    } finally {
      setExportingReport(false);
    }
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
        <TouchableOpacity
          style={[styles.exportButton, exportingReport && styles.exportButtonDisabled]}
          onPress={handleExportInsuranceReport}
          disabled={exportingReport}
        >
          <Text style={styles.exportButtonText}>
            {exportingReport ? 'Generating report...' : 'Export Insurance Report'}
          </Text>
        </TouchableOpacity>
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
  exportButton: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.65,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
