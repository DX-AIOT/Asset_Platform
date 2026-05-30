import { api } from './api';
import type { Transaction, FiledDispute } from '../types/item';

export const transactionApi = {
  list: () =>
    api.get<Transaction[]>('/transactions'),

  findOne: (id: string) =>
    api.get<Transaction>(`/transactions/${id}`),

  fileDispute: (id: string, body: FiledDispute) =>
    api.post<Transaction>(`/transactions/${id}/dispute`, body),

  confirmReceipt: (id: string) =>
    api.post<Transaction>(`/transactions/${id}/confirm-receipt`),
};
