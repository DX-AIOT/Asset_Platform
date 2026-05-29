import { ConfigService } from '@nestjs/config';
import { MaintenanceJobService } from '../src/reminders/maintenance-job.service';
import { MaintenanceReminder } from '../src/reminders/entities/maintenance-reminder.entity';
import { encryptToken } from '../src/common/crypto.util';

const KEY_HEX = 'b'.repeat(64); // 32-byte test key

function makeConfig(keyHex?: string) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'PUSH_TOKEN_ENCRYPTION_KEY') return keyHex ?? KEY_HEX;
      return undefined;
    }),
  } as unknown as ConfigService;
}

function makeRemindersService(reminders: Partial<MaintenanceReminder>[]) {
  return {
    findUpcomingWithUsers: jest.fn(async () => reminders),
  };
}

function makeFirebaseService() {
  return {
    sendToDevice: jest.fn(async () => undefined),
  };
}

function makeExpoService() {
  return {
    sendToDevice: jest.fn(async () => undefined),
  };
}

function makeNotificationsRepo() {
  return {
    create: jest.fn((data) => data),
    save: jest.fn(async (entity) => ({ id: 'notif-1', ...entity })),
  };
}

describe('MaintenanceJobService', () => {
  it('creates in-app notifications for each upcoming reminder', async () => {
    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r1',
        itemId: 'item-1',
        userId: 'user-1',
        title: 'Oil change',
        intervalDays: 90,
        nextDueAt: new Date(Date.now() + 2 * 86400000),
        item: { id: 'item-1', name: 'Car', user: { id: 'user-1', fcmToken: null, pushToken: null } } as any,
      },
    ];

    const notifRepo = makeNotificationsRepo();
    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      makeFirebaseService() as any,
      makeExpoService() as any,
      notifRepo as any,
      makeConfig(),
    );

    await job.sendDueReminders();

    expect(notifRepo.save).toHaveBeenCalledTimes(1);
    const saved = notifRepo.save.mock.calls[0][0];
    expect(saved.userId).toBe('user-1');
    expect(saved.title).toContain('Oil change');
    expect(saved.type).toBe('maintenance_reminder');
    expect(saved.referenceId).toBe('r1');
  });

  it('sends Expo push when user has a pushToken (decrypted before sending)', async () => {
    const expoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    const encryptedToken = encryptToken(expoToken, KEY_HEX);

    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r2',
        itemId: 'item-2',
        userId: 'user-2',
        title: 'Tyre rotation',
        intervalDays: 180,
        nextDueAt: new Date(Date.now() + 1 * 86400000),
        item: {
          id: 'item-2',
          name: 'Truck',
          user: { id: 'user-2', fcmToken: null, pushToken: encryptedToken },
        } as any,
      },
    ];

    const expoSvc = makeExpoService();
    const firebaseSvc = makeFirebaseService();
    const notifRepo = makeNotificationsRepo();

    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      firebaseSvc as any,
      expoSvc as any,
      notifRepo as any,
      makeConfig(),
    );

    await job.sendDueReminders();

    expect(expoSvc.sendToDevice).toHaveBeenCalledWith(
      expoToken,
      expect.objectContaining({ title: expect.stringContaining('Tyre rotation') }),
    );
    expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
  });

  it('falls back to Firebase FCM when user has fcmToken but no pushToken', async () => {
    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r3',
        itemId: 'item-3',
        userId: 'user-3',
        title: 'Service',
        intervalDays: 365,
        nextDueAt: new Date(Date.now() + 3 * 86400000),
        item: {
          id: 'item-3',
          name: 'Bike',
          user: { id: 'user-3', fcmToken: 'valid-fcm-token', pushToken: null },
        } as any,
      },
    ];

    const firebaseSvc = makeFirebaseService();
    const expoSvc = makeExpoService();
    const notifRepo = makeNotificationsRepo();

    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      firebaseSvc as any,
      expoSvc as any,
      notifRepo as any,
      makeConfig(),
    );

    await job.sendDueReminders();

    expect(firebaseSvc.sendToDevice).toHaveBeenCalledWith(
      'valid-fcm-token',
      expect.objectContaining({ title: expect.stringContaining('Service') }),
    );
    expect(expoSvc.sendToDevice).not.toHaveBeenCalled();
  });

  it('skips all push sends when both pushToken and fcmToken are null', async () => {
    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r4',
        itemId: 'item-4',
        userId: 'user-4',
        title: 'Brake check',
        intervalDays: 60,
        nextDueAt: new Date(Date.now() + 3 * 86400000),
        item: { id: 'item-4', name: 'Scooter', user: { id: 'user-4', fcmToken: null, pushToken: null } } as any,
      },
    ];

    const firebaseSvc = makeFirebaseService();
    const expoSvc = makeExpoService();
    const notifRepo = makeNotificationsRepo();

    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      firebaseSvc as any,
      expoSvc as any,
      notifRepo as any,
      makeConfig(),
    );

    await job.sendDueReminders();

    expect(expoSvc.sendToDevice).not.toHaveBeenCalled();
    expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
  });

  it('marks overdue reminders with correct message', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r5',
        itemId: 'item-5',
        userId: 'user-5',
        title: 'Brake check',
        intervalDays: 60,
        nextDueAt: yesterday,
        item: { id: 'item-5', name: 'Scooter', user: { id: 'user-5', fcmToken: null, pushToken: null } } as any,
      },
    ];

    const notifRepo = makeNotificationsRepo();
    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      makeFirebaseService() as any,
      makeExpoService() as any,
      notifRepo as any,
      makeConfig(),
    );

    await job.sendDueReminders();

    const saved = notifRepo.save.mock.calls[0][0];
    expect(saved.body).toContain('overdue');
  });

  it('handles empty reminder list without errors', async () => {
    const notifRepo = makeNotificationsRepo();
    const firebaseSvc = makeFirebaseService();
    const expoSvc = makeExpoService();

    const job = new MaintenanceJobService(
      makeRemindersService([]) as any,
      firebaseSvc as any,
      expoSvc as any,
      notifRepo as any,
      makeConfig(),
    );

    await expect(job.sendDueReminders()).resolves.not.toThrow();
    expect(notifRepo.save).not.toHaveBeenCalled();
    expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
    expect(expoSvc.sendToDevice).not.toHaveBeenCalled();
  });

  it('skips Expo send when PUSH_TOKEN_ENCRYPTION_KEY is not configured', async () => {
    const encryptedToken = encryptToken('ExponentPushToken[abc]', KEY_HEX);
    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r6',
        itemId: 'item-6',
        userId: 'user-6',
        title: 'Check',
        intervalDays: 30,
        nextDueAt: new Date(Date.now() + 86400000),
        item: {
          id: 'item-6',
          name: 'Device',
          user: { id: 'user-6', fcmToken: null, pushToken: encryptedToken },
        } as any,
      },
    ];

    const expoSvc = makeExpoService();
    const firebaseSvc = makeFirebaseService();
    const noKeyConfig = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      firebaseSvc as any,
      expoSvc as any,
      makeNotificationsRepo() as any,
      noKeyConfig,
    );

    await job.sendDueReminders();

    expect(expoSvc.sendToDevice).not.toHaveBeenCalled();
    expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
  });
});
