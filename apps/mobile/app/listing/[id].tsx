import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
  Linking,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { marketplaceApi } from '../../services/marketplaceApi';
import { Listing } from '../../types/listing';
import { CATEGORY_LABELS } from '../../types/item';

const { width } = Dimensions.get('window');

const CONDITION_BADGE: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: '#34C759' },
  like_new: { label: 'Like New', color: '#30D158' },
  good: { label: 'Good', color: '#007AFF' },
  fair: { label: 'Fair', color: '#FF9500' },
  poor: { label: 'Poor', color: '#FF3B30' },
};

export default function ListingDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id as string;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    try {
      const response = await marketplaceApi.getListingById(id);
      setListing(response.data);
    } catch (error) {
      console.error('Failed to fetch listing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    Alert.prompt(
      'Contact Seller',
      'Send a message to the seller',
      async (message) => {
        if (!message?.trim()) return;
        setContacting(true);
        try {
          await marketplaceApi.contactSeller(id, message.trim());
          Alert.alert('Sent!', 'Your message has been sent to the seller.');
        } catch (error) {
          Alert.alert('Error', 'Failed to send message. Please try again.');
        } finally {
          setContacting(false);
        }
      },
      'plain-text',
      `Hi, I'm interested in your listing for ${listing?.title}.`
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Listing not found</Text>
      </View>
    );
  }

  const badge = CONDITION_BADGE[listing.condition] ?? { label: listing.condition, color: '#999' };

  return (
    <>
      <Stack.Screen options={{ title: listing.title }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {listing.photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
          >
            {listing.photos.map((photo, index) => (
              <Image
                key={index}
                source={{ uri: photo }}
                style={styles.galleryImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.galleryPlaceholder}>
            <Text style={styles.galleryPlaceholderText}>📦</Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{listing.title}</Text>
            <View style={[styles.conditionBadge, { backgroundColor: badge.color + '22' }]}>
              <Text style={[styles.conditionBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          <Text style={styles.price}>${Number(listing.price).toLocaleString()}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{CATEGORY_LABELS[listing.category]}</Text>
            </View>
          </View>

          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          <View style={styles.sellerCard}>
            <Text style={styles.sellerCardLabel}>Seller</Text>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerAvatarText}>
                  {listing.seller.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>{listing.seller.name}</Text>
                {listing.seller.joinedAt && (
                  <Text style={styles.sellerSince}>
                    Member since {new Date(listing.seller.joinedAt).getFullYear()}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.contactButton, contacting && styles.contactButtonDisabled]}
          onPress={handleContact}
          disabled={contacting}
        >
          {contacting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.contactButtonText}>Contact Seller</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  gallery: {
    height: 300,
  },
  galleryImage: {
    width,
    height: 300,
  },
  galleryPlaceholder: {
    width,
    height: 300,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPlaceholderText: {
    fontSize: 80,
  },
  body: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  conditionBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  conditionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  metaChip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 13,
    color: '#555',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  sellerCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  sellerCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  sellerSince: {
    fontSize: 13,
    color: '#999',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  contactButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  contactButtonDisabled: {
    opacity: 0.6,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
