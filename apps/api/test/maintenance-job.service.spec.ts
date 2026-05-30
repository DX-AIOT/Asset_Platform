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

function makeExpoService(deadTokens: string[] = []) {
  return {
    sendToDevice: jest.fn(async () => ({ deadTokens })),
  };
}

function makeNotificationsRepo() {
  return {
    create: jest.fn((data) => data),
    save: jest.fn(async (entity) => ({ id: 'notif-1', ...entity })),
  };
}

function makeUsersService() {
  return {
    update: jest.fn(async () => ({ id: 'user-id' })),
  };
}

function buildJob(
  reminders: Partial<MaintenanceReminder>[],
  {
    expoDeadTokens = [],
    configKeyHex,
    usersSvc,
    notifRepo,
    expoSvc,
    firebaseSvc,
  }: {
    expoDeadTokens?: string[];
    configKeyHex?: string;
    usersSvc?: ReturnType<typeof makeUsersService>;
    notifRepo?: ReturnType<typeof makeNotificationsRepo>;
    expoSvc?: ReturnType<typeof makeExpoService>;
    firebaseSvc?: ReturnType<typeof makeFirebaseService>;
  } = {},
) {
  return new MaintenanceJobService(
    makeRemindersService(reminders) as any,
    (firebaseSvc ?? makeFirebaseService()) as any,
    (expoSvc ?? makeExpoService(expoDeadTokens)) as any,
    (notifRepo ?? makeNotificationsRepo()) as any,
    makeConfig(configKeyHex),
    (usersSvc ?? makeUsersService()) as any,
  );
}

describe('MaintenanceJobService', () => {
  describe('in-app notification creation', () => {
    it('creates an in-app notification for each upcoming reminder', async () => {
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
      const job = buildJob(reminders, { notifRepo });
      await job.sendDueReminders();

      expect(notifRepo.save).toHaveBeenCalledTimes(1);
      const saved = notifRepo.save.mock.calls[0][0];
      expect(saved.userId).toBe('user-1');
      expect(saved.title).toContain('Oil change');
      expect(saved.type).toBe('maintenance_reminder');
      expect(saved.referenceId).toBe('r1');
      expect(saved.isRead).toBe(false);
    });

    it('marks overdue reminders with "overdue" in the notification body', async () => {
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
      const job = buildJob(reminders, { notifRepo });
      await job.sendDueReminders();

      const saved = notifRepo.save.mock.calls[0][0];
      expect(saved.body).toContain('overdue');
    });

    it('handles empty reminder list without errors', async () => {
      const notifRepo = makeNotificationsRepo();
      const firebaseSvc = makeFirebaseService();
      const expoSvc = makeExpoService();
      const job = buildJob([], { notifRepo, firebaseSvc, expoSvc });

      await expect(job.sendDueReminders()).resolves.not.toThrow();
      expect(notifRepo.save).not.toHaveBeenCalled();
      expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
      expect(expoSvc.sendToDevice).not.toHaveBeenCalled();
    });
  });

  describe('push payload construction', () => {
    it('sends correct title/body/data push payload via Expo', async () => {
      const expoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      const encryptedToken = encryptToken(expoToken, KEY_HEX);

      const reminders: Partial<MaintenanceReminder>[] = [
        {
          id: 'reminder-payload',
          itemId: 'item-payload',
          userId: 'user-payload',
          title: 'Coolant flush',
          intervalDays: 180,
          nextDueAt: new Date(Date.now() + 86400000),
          item: {
            id: 'item-payload',
            name: 'Radiator',
            user: { id: 'user-payload', fcmToken: null, pushToken: encryptedToken },
          } as any,
        },
      ];

      const expoSvc = makeExpoService();
      const job = buildJob(reminders, { expoSvc });
      await job.sendDueReminders();

      expect(expoSvc.sendToDevice).toHaveBeenCalledWith(
        expoToken,
        expect.objectContaining({
          title: 'Maintenance due: Coolant flush',
          body: expect.stringContaining('day(s)'),
          data: {
            reminderId: 'reminder-payload',
            itemId: 'item-payload',
            itemName: 'Radiator',
          },
        }),
      );
    });

    it('sends correct FCM payload including data field', async () => {
      const reminders: Partial<MaintenanceReminder>[] = [
        {
          id: 'reminder-fcm',
          itemId: 'item-fcm',
          userId: 'user-fcm',
          title: 'Filter replace',
          intervalDays: 365,
          nextDueAt: new Date(Date.now() + 3 * 86400000),
          item: {
            id: 'item-fcm',
            name: 'HVAC',
            user: { id: 'user-fcm', fcmToken: 'valid-fcm-token', pushToken: null },
          } as any,
        },
      ];

      const firebaseSvc = makeFirebaseService();
      const job = buildJob(reminders, { firebaseSvc });
      await job.sendDueReminders();

      expect(firebaseSvc.sendToDevice).toHaveBeenCalledWith(
        'valid-fcm-token',
        expect.objectContaining({
          title: 'Maintenance due: Filter replace',
          data: {
            reminderId: 'reminder-fcm',
            itemId: 'item-fcm',
            itemName: 'HVAC',
          },
        }),
      );
    });
  });

  describe('push channel selection', () => {
    it('sends Expo push when user has a pushToken (decrypts before sending)', async () => {
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
      const job = buildJob(reminders, { expoSvc, firebaseSvc });
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
      const job = buildJob(reminders, { firebaseSvc, expoSvc });
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
      const job = buildJob(reminders, { firebaseSvc, expoSvc, notifRepo });
      await job.sendDueReminders();

      expect(expoSvc.sendToDevice).not.toHaveBeenCalled();
      expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
      expect(notifRepo.save).toHaveBeenCalledTimes(1);
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
      const noKeyConfig = { get: jest.fn(() => undefined) } as unknown as ConfigService;

      const job = new MaintenanceJobService(
        makeRemindersService(reminders) as any,
        firebaseSvc as any,
        expoSvc as any,
        makeNotificationsRepo() as any,
        noKeyConfig,
        makeUsersService() as any,
      );
      await job.sendDueReminders();

      expect(expoSvc.sendToDevice).not.toHaveBeenCalled();
      expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
    });
  });

  describe('DeviceNotRegistered token lifecycle', () => {
    it('clears pushToken when Expo returns DeviceNotRegistered', async () => {
      const expoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      const encryptedToken = encryptToken(expoToken, KEY_HEX);

      const reminders: Partial<MaintenanceReminder>[] = [
        {
          id: 'r-dead',
          itemId: 'item-dead',
          userId: 'user-dead',
          title: 'Belt check',
          intervalDays: 60,
          nextDueAt: new Date(Date.now() + 86400000),
          item: {
            id: 'item-dead',
            name: 'Engine',
            user: { id: 'user-dead', fcmToken: null, pushToken: encryptedToken },
          } as any,
        },
      ];

      const expoSvc = makeExpoService([expoToken]); // returns dead token
      const usersSvc = makeUsersService();
      const job = buildJob(reminders, { expoSvc, usersSvc });
      await job.sendDueReminders();

      expect(usersSvc.update).toHaveBeenCalledWith('user-dead', { pushToken: null });
    });

    it('does not clear pushToken when Expo reports success', async () => {
      const expoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      const encryptedToken = encryptToken(expoToken, KEY_HEX);

      const reminders: Partial<MaintenanceReminder>[] = [
        {
          id: 'r-ok',
          itemId: 'item-ok',
          userId: 'user-ok',
          title: 'Tyre check',
          intervalDays: 90,
          nextDueAt: new Date(Date.now() + 86400000),
          item: {
            id: 'item-ok',
            name: 'Car',
            user: { id: 'user-ok', fcmToken: null, pushToken: encryptedToken },
          } as any,
        },
      ];

      const expoSvc = makeExpoService([]); // no dead tokens
      const usersSvc = makeUsersService();
      const job = buildJob(reminders, { expoSvc, usersSvc });
      await job.sendDueReminders();

      expect(usersSvc.update).not.toHaveBeenCalled();
    });

    it('does not clear pushToken for non-DeviceNotRegistered Expo errors', async () => {
      const expoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      const encryptedToken = encryptToken(expoToken, KEY_HEX);

      const reminders: Partial<MaintenanceReminder>[] = [
        {
          id: 'r-rate',
          itemId: 'item-rate',
          userId: 'user-rate',
          title: 'Brake pad',
          intervalDays: 180,
          nextDueAt: new Date(Date.now() + 86400000),
          item: {
            id: 'item-rate',
            name: 'Motorcycle',
            user: { id: 'user-rate', fcmToken: null, pushToken: encryptedToken },
          } as any,
        },
      ];

      // Rate-limit error returns no dead tokens
      const expoSvc = makeExpoService([]);
      const usersSvc = makeUsersService();
      const job = buildJob(reminders, { expoSvc, usersSvc });
      await job.sendDueReminders();

      expect(usersSvc.update).not.toHaveBeenCalled();
    });
  });

  describe('scheduling: daysUntilDue with fake timers', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('produces "overdue" body when system clock is past nextDueAt', async () => {
      jest.setSystemTime(new Date('2026-06-01T08:00:00Z'));
      const pastDue = new Date('2026-05-30T00:00:00Z');

      const reminders: Partial<MaintenanceReminder>[] = [
        {
          id: 'r-past',
          itemId: 'item-past',
          userId: 'user-past',
          title: 'Filter change',
          intervalDays: 30,
          nextDueAt: pastDue,
          item: {
            id: 'item-past',
            name: 'AC Unit',
            user: { id: 'user-past', fcmToken: null, pushToken: null },
          } as any,
        },
      ];

      const notifRepo = makeNotificationsRepo();
      const job = buildJob(reminders, { notifRepo });
      await job.sendDueReminders();

      const saved = notifRepo.save.mock.calls[0][0];
      expect(saved.body).toContain('overdue');
    });

    it('produces "in X day(s)" body when nextDueAt is in the future', async () => {
      jest.setSystemTime(new Date('2026-05-30T08:00:00Z'));
      const twoDaysOut = new Date('2026-06-01T08:00:00Z');

      const reminders: Partial<MaintenanceReminder>[] = [
        {
          id: 'r-future',
          itemId: 'item-future',
          userId: 'user-future',
          title: 'Battery replace',
          intervalDays: 365,
          nextDueAt: twoDaysOut,
          item: {
            id: 'item-future',
            name: 'UPS',
            user: { id: 'user-future', fcmToken: null, pushToken: null },
          } as any,
        },
      ];

      const notifRepo = makeNotificationsRepo();
      const job = buildJob(reminders, { notifRepo });
      await job.sendDueReminders();

      const saved = notifRepo.save.mock.calls[0][0];
      expect(saved.body).toMatch(/in \d+ day\(s\)/);
      expect(saved.body).toContain('2 day(s)');
    });

    it('produces "in 1 day(s)" body for a reminder due exactly one day from now', async () => {
      jest.setSystemTime(new Date('2026-05-30T08:00:00Z'));
      const oneDayOut = new Date('2026-05-31T08:00:00Z');

      const reminders: Partial<MaintenanceReminder>[] = [
        {
          id: 'r-oneday',
          itemId: 'item-oneday',
          userId: 'user-oneday',
          title: 'Oil top-up',
          intervalDays: 30,
          nextDueAt: oneDayOut,
          item: {
            id: 'item-oneday',
            name: 'Generator',
            user: { id: 'user-oneday', fcmToken: null, pushToken: null },
          } as any,
        },
      ];

      const notifRepo = makeNotificationsRepo();
      const job = buildJob(reminders, { notifRepo });
      await job.sendDueReminders();

      const saved = notifRepo.save.mock.calls[0][0];
      expect(saved.body).toContain('1 day(s)');
    });
  });
});
