import { MaintenanceJobService } from '../src/reminders/maintenance-job.service';
import { MaintenanceReminder } from '../src/reminders/entities/maintenance-reminder.entity';

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
        item: { id: 'item-1', name: 'Car', user: { id: 'user-1', fcmToken: null } } as any,
      },
    ];

    const notifRepo = makeNotificationsRepo();
    const firebaseSvc = makeFirebaseService();

    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      firebaseSvc as any,
      notifRepo as any,
    );

    await job.sendDueReminders();

    expect(notifRepo.save).toHaveBeenCalledTimes(1);
    const saved = notifRepo.save.mock.calls[0][0];
    expect(saved.userId).toBe('user-1');
    expect(saved.title).toContain('Oil change');
    expect(saved.type).toBe('maintenance_reminder');
    expect(saved.referenceId).toBe('r1');
  });

  it('sends FCM push when user has an fcmToken', async () => {
    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r2',
        itemId: 'item-2',
        userId: 'user-2',
        title: 'Tyre rotation',
        intervalDays: 180,
        nextDueAt: new Date(Date.now() + 1 * 86400000),
        item: { id: 'item-2', name: 'Truck', user: { id: 'user-2', fcmToken: 'valid-token-abc' } } as any,
      },
    ];

    const firebaseSvc = makeFirebaseService();
    const notifRepo = makeNotificationsRepo();

    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      firebaseSvc as any,
      notifRepo as any,
    );

    await job.sendDueReminders();

    expect(firebaseSvc.sendToDevice).toHaveBeenCalledWith(
      'valid-token-abc',
      expect.objectContaining({ title: expect.stringContaining('Tyre rotation') }),
    );
  });

  it('skips FCM send when fcmToken is null', async () => {
    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r3',
        itemId: 'item-3',
        userId: 'user-3',
        title: 'Service',
        intervalDays: 365,
        nextDueAt: new Date(Date.now() + 3 * 86400000),
        item: { id: 'item-3', name: 'Bike', user: { id: 'user-3', fcmToken: null } } as any,
      },
    ];

    const firebaseSvc = makeFirebaseService();
    const notifRepo = makeNotificationsRepo();

    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      firebaseSvc as any,
      notifRepo as any,
    );

    await job.sendDueReminders();

    expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
  });

  it('marks overdue reminders with correct message', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    const reminders: Partial<MaintenanceReminder>[] = [
      {
        id: 'r4',
        itemId: 'item-4',
        userId: 'user-4',
        title: 'Brake check',
        intervalDays: 60,
        nextDueAt: yesterday,
        item: { id: 'item-4', name: 'Scooter', user: { id: 'user-4', fcmToken: null } } as any,
      },
    ];

    const notifRepo = makeNotificationsRepo();

    const job = new MaintenanceJobService(
      makeRemindersService(reminders) as any,
      makeFirebaseService() as any,
      notifRepo as any,
    );

    await job.sendDueReminders();

    const saved = notifRepo.save.mock.calls[0][0];
    expect(saved.body).toContain('overdue');
  });

  it('handles empty reminder list without errors', async () => {
    const notifRepo = makeNotificationsRepo();
    const firebaseSvc = makeFirebaseService();

    const job = new MaintenanceJobService(
      makeRemindersService([]) as any,
      firebaseSvc as any,
      notifRepo as any,
    );

    await expect(job.sendDueReminders()).resolves.not.toThrow();
    expect(notifRepo.save).not.toHaveBeenCalled();
    expect(firebaseSvc.sendToDevice).not.toHaveBeenCalled();
  });
});
