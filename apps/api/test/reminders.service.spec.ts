import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RemindersService } from '../src/reminders/reminders.service';
import { MaintenanceReminder } from '../src/reminders/entities/maintenance-reminder.entity';
import { MaintenanceRecord } from '../src/reminders/entities/maintenance-record.entity';
import { Item } from '../src/items/entities/item.entity';

const userId = 'user-1';
const itemId = 'item-1';
const reminderId = 'reminder-1';

function makeRemindersRepo(overrides: Partial<any> = {}) {
  return {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (entity) => ({ id: reminderId, ...entity })),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    remove: jest.fn(async () => undefined),
    ...overrides,
  };
}

function makeRecordsRepo(overrides: Partial<any> = {}) {
  return {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (entity) => ({ id: 'record-1', ...entity })),
    ...overrides,
  };
}

function makeItemsRepo(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(async () => ({ id: itemId, userId, name: 'Car' } as Item)),
    ...overrides,
  };
}

function makeService(
  remindersRepo = makeRemindersRepo(),
  recordsRepo = makeRecordsRepo(),
  itemsRepo = makeItemsRepo(),
) {
  return new RemindersService(
    remindersRepo as any,
    recordsRepo as any,
    itemsRepo as any,
  );
}

describe('RemindersService', () => {
  describe('create', () => {
    it('saves a new reminder with computed nextDueAt when not provided', async () => {
      const svc = makeService();
      const before = new Date();
      const result = await svc.create(itemId, userId, {
        title: 'Oil change',
        intervalDays: 180,
      });
      expect(result.title).toBe('Oil change');
      expect(result.intervalDays).toBe(180);
      const nextDue = new Date(result.nextDueAt);
      expect(nextDue.getTime()).toBeGreaterThanOrEqual(before.getTime() + 179 * 86400000);
    });

    it('uses provided nextDueAt when given', async () => {
      const svc = makeService();
      const customDate = '2030-01-01T00:00:00.000Z';
      const result = await svc.create(itemId, userId, {
        title: 'Tyre rotation',
        intervalDays: 90,
        nextDueAt: customDate,
      });
      expect(new Date(result.nextDueAt).toISOString()).toBe(new Date(customDate).toISOString());
    });

    it('throws NotFoundException when item does not belong to user', async () => {
      const svc = makeService(
        makeRemindersRepo(),
        makeRecordsRepo(),
        makeItemsRepo({ findOne: jest.fn(async () => null) }),
      );
      await expect(
        svc.create(itemId, userId, { title: 'X', intervalDays: 30 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates allowed fields and saves', async () => {
      const existing: Partial<MaintenanceReminder> = {
        id: reminderId,
        userId,
        title: 'Old',
        intervalDays: 30,
        nextDueAt: new Date(),
        notes: null,
      };
      const saveMock = jest.fn(async (e) => e);
      const svc = makeService(
        makeRemindersRepo({
          findOne: jest.fn(async () => existing),
          save: saveMock,
        }),
      );
      const result = await svc.update(reminderId, userId, { title: 'New' });
      expect(result.title).toBe('New');
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when userId does not match', async () => {
      const existing = { id: reminderId, userId: 'other-user' };
      const svc = makeService(
        makeRemindersRepo({ findOne: jest.fn(async () => existing) }),
      );
      await expect(svc.update(reminderId, userId, { title: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when reminder not found', async () => {
      const svc = makeService(
        makeRemindersRepo({ findOne: jest.fn(async () => null) }),
      );
      await expect(svc.update(reminderId, userId, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('complete', () => {
    it('creates a record and advances nextDueAt by intervalDays', async () => {
      const now = new Date('2025-06-01T00:00:00Z');
      const existing: Partial<MaintenanceReminder> = {
        id: reminderId,
        userId,
        intervalDays: 90,
        lastCompletedAt: null,
        nextDueAt: new Date('2025-06-01T00:00:00Z'),
      };
      const reminderSave = jest.fn(async (e) => e);
      const svc = makeService(
        makeRemindersRepo({
          findOne: jest.fn(async () => existing),
          save: reminderSave,
        }),
        makeRecordsRepo({ save: jest.fn(async (e) => ({ id: 'r1', ...e })) }),
      );
      const record = await svc.complete(reminderId, userId, {
        completedAt: now.toISOString(),
      });
      expect(record.completedAt).toEqual(now);

      const savedReminder = reminderSave.mock.calls[0][0] as MaintenanceReminder;
      expect(savedReminder.lastCompletedAt).toEqual(now);
      const expectedNext = new Date(now);
      expectedNext.setDate(expectedNext.getDate() + 90);
      expect(savedReminder.nextDueAt).toEqual(expectedNext);
    });

    it('defaults completedAt to now when not provided', async () => {
      const before = new Date();
      const existing = { id: reminderId, userId, intervalDays: 30, lastCompletedAt: null, nextDueAt: new Date() };
      const reminderSave = jest.fn(async (e) => e);
      const svc = makeService(
        makeRemindersRepo({ findOne: jest.fn(async () => existing), save: reminderSave }),
        makeRecordsRepo({ save: jest.fn(async (e) => ({ id: 'r2', ...e })) }),
      );
      await svc.complete(reminderId, userId, {});
      const saved = reminderSave.mock.calls[0][0] as MaintenanceReminder;
      expect(saved.lastCompletedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('remove', () => {
    it('calls repo.remove for owned reminder', async () => {
      const removeMock = jest.fn(async () => undefined);
      const existing = { id: reminderId, userId };
      const svc = makeService(
        makeRemindersRepo({ findOne: jest.fn(async () => existing), remove: removeMock }),
      );
      await svc.remove(reminderId, userId);
      expect(removeMock).toHaveBeenCalledWith(existing);
    });
  });
});
