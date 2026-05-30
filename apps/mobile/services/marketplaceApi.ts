import { api } from './api';
import type {
  Listing,
  ListingsPage,
  BrowseListingsQuery,
  CreateListingData,
  ListingPriceSuggestion,
  ListingAutofillDraft,
} from '../types/listing';

export const marketplaceApi = {
  browse: (query: BrowseListingsQuery = {}) =>
    api.get<ListingsPage>('/marketplace/listings', { params: query }),

  findOne: (id: string) =>
    api.get<Listing>(`/marketplace/listings/${id}`),

  create: (data: CreateListingData) =>
    api.post<Listing>('/marketplace/listings', data),

  publish: (id: string) =>
    api.post<Listing>(`/marketplace/listings/${id}/publish`),

  getAutofill: (itemId: string) =>
    api.get<ListingAutofillDraft>(`/ai/listing-autofill/${itemId}`),

  getPriceSuggestion: (itemId: string, condition?: string) =>
    api.post<ListingPriceSuggestion>('/ai/listing-price-suggest', {
      itemId,
      ...(condition ? { condition } : {}),
    }),
};
