import { api } from './api';
import {
  CompleteReminderDto,
  CreateReminderDto,
  MaintenanceReminder,
} from '../types/reminder';

export const remindersApi = {
  listByItem: (itemId: string) =>
    api.get<MaintenanceReminder[]>(`/assets/${itemId}/reminders`),

  create: (itemId: string, payload: CreateReminderDto) =>
    api.post<MaintenanceReminder>(`/assets/${itemId}/reminders`, payload),

  complete: (reminderId: string, payload: CompleteReminderDto = {}) =>
    api.post(`/reminders/${reminderId}/complete`, payload),
};
