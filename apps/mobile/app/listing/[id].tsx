import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { marketplaceApi } from '../../services/marketplaceApi';
import type { Listing } from '../../types/listing';
import { CONDITION_LABELS, CONDITION_COLORS } from '../../types/listing';

const { width } = Dimensions.get('window');

function memberSinceYear(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString();
}

export default function ListingDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    marketplaceApi
      .findOne(id)
      .then((res) => setListing(res.data))
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const condColor = CONDITION_COLORS[listing.condition] ?? '#007AFF';
  const photos = listing.photos ?? [];

  return (
    <>
      <Stack.Screen options={{ title: '', headerTransparent: photos.length > 0 }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Photo gallery */}
        {photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                setPhotoIndex(idx);
              }}
            >
              {photos.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={{ width, height: width }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {photos.length > 1 && (
              <View style={styles.dotRow}>
                {photos.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === photoIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>No photos</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Title */}
          {listing.title ? (
            <Text style={styles.listingTitle}>{listing.title}</Text>
          ) : null}

          {/* Price */}
          <Text style={styles.price}>
            {listing.currency} {Number(listing.price).toLocaleString()}
          </Text>

          {/* Condition badge */}
          <View style={[styles.condBadge, { backgroundColor: condColor + '20' }]}>
            <Text style={[styles.condText, { color: condColor }]}>
              {CONDITION_LABELS[listing.condition]}
            </Text>
          </View>

          {/* Description */}
          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          {/* Location */}
          {listing.city ? (
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>{listing.city}</Text>
            </View>
          ) : null}

          {/* Seller info */}
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              {listing.seller?.avatar ? (
                <Image
                  source={{ uri: listing.seller.avatar }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarFallback}>
                  {(listing.seller?.name ?? 'S')[0].toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{listing.seller?.name ?? 'Seller'}</Text>
              {listing.seller?.memberSince ? (
                <Text style={styles.sellerMeta}>
                  Member since {memberSinceYear(listing.seller.memberSince)}
                </Text>
              ) : null}
              {listing.city ? (
                <Text style={styles.sellerMeta}>{listing.city}</Text>
              ) : null}
            </View>
          </View>

          {/* Contact button (placeholder for MVP) */}
          <TouchableOpacity style={styles.contactBtn} disabled>
            <Text style={styles.contactBtnText}>Contact Seller</Text>
            <Text style={styles.contactBtnSub}>Coming soon</Text>
          </TouchableOpacity>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#888',
  },
  backLink: {
    fontSize: 14,
    color: '#007AFF',
  },
  photoPlaceholder: {
    width,
    height: width * 0.6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: '#bbb',
    fontSize: 14,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  body: {
    padding: 20,
  },
  listingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: '#007AFF',
    marginBottom: 10,
  },
  condBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 20,
  },
  condText: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  locationIcon: {
    fontSize: 14,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
  },
  avatarFallback: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  sellerMeta: {
    fontSize: 13,
    color: '#888',
  },
  contactBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    opacity: 0.45,
  },
  contactBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  contactBtnSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});
