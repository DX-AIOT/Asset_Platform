import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Item, CATEGORY_LABELS } from '../types/item';

interface ItemCardProps {
  item: Item;
  onPress: () => void;
}

export function ItemCard({ item, onPress }: ItemCardProps) {
  const thumbnail = item.photos && item.photos.length > 0 ? item.photos[0] : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>📦</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>

        {item.brand && (
          <Text style={styles.brand} numberOfLines={1}>
            {item.brand}
          </Text>
        )}

        <View style={styles.row}>
          <Text style={styles.category}>{CATEGORY_LABELS[item.category] || item.category}</Text>
          {item.purchasePrice && (
            <Text style={styles.price}>${Number(item.purchasePrice).toLocaleString()}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: 100,
    height: 100,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 40,
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  brand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});
