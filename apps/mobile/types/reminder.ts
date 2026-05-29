export interface MaintenanceReminder {
  id: string;
  itemId: string;
  userId: string;
  title: string;
  intervalDays: number;
  lastCompletedAt: string | null;
  nextDueAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderDto {
  title: string;
  intervalDays: number;
  nextDueAt?: string;
  notes?: string;
}

export interface CompleteReminderDto {
  completedAt?: string;
  notes?: string;
  cost?: number;
}
