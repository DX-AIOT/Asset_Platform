import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { itemsApi } from '../../services/itemsApi';
import { Item, CATEGORY_LABELS } from '../../types/item';

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

  useEffect(() => {
    fetchItem();
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
            {item.brand && (
              <Text style={styles.brand}>{item.brand}</Text>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>
                  {CATEGORY_LABELS[item.category]}
                </Text>
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
              <Text style={styles.priceValue}>
                ${Number(item.purchasePrice).toLocaleString()}
              </Text>
            </View>
          )}

          {item.purchaseDate && (
            <View style={styles.section}>
              <Text style={styles.label}>Purchase Date</Text>
              <Text style={styles.value}>
                {new Date(item.purchaseDate).toLocaleDateString()}
              </Text>
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
});
