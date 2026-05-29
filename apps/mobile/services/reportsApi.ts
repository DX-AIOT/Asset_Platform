import { api } from './api';

export const reportsApi = {
  generateInsurancePdf: (categoryIds?: string[]) => {
    const params = new URLSearchParams({ format: 'pdf' });
    if (categoryIds && categoryIds.length > 0) {
      params.set('categoryIds', categoryIds.join(','));
    }

    return api.get<ArrayBuffer>(`/reports/insurance?${params.toString()}`, {
      responseType: 'arraybuffer',
    });
  },
};
