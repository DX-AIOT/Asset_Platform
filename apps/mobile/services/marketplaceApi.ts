import { api } from './api';
import { Listing, CreateListingDto, ListingsResponse, ListingFilters, PriceSuggestion } from '../types/listing';
import { ItemCategory, ItemCondition } from '../types/item';

export const marketplaceApi = {
  getListings: (filters?: ListingFilters) => {
    const params = new URLSearchParams();
    if (filters?.q) params.append('q', filters.q);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.condition) params.append('condition', filters.condition);
    if (filters?.minPrice !== undefined) params.append('minPrice', String(filters.minPrice));
    if (filters?.maxPrice !== undefined) params.append('maxPrice', String(filters.maxPrice));
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    const qs = params.toString();
    return api.get<ListingsResponse>(`/marketplace/listings${qs ? `?${qs}` : ''}`);
  },

  getListingById: (id: string) => api.get<Listing>(`/marketplace/listings/${id}`),

  createListing: (data: CreateListingDto) =>
    api.post<Listing>('/marketplace/listings', data),

  suggestPrice: (data: {
    name: string;
    category: ItemCategory;
    condition: ItemCondition;
    brand?: string;
    model?: string;
    purchasePrice?: number;
  }) => api.post<PriceSuggestion>('/marketplace/price-suggestion', data),

  contactSeller: (listingId: string, message: string) =>
    api.post<{ success: boolean }>(`/marketplace/listings/${listingId}/contact`, { message }),
};
