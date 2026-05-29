import { ConfigService } from '@nestjs/config';
import { ExpoNotificationsService } from '../src/reminders/expo-notifications.service';

function makeConfig(accessToken?: string) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'EXPO_ACCESS_TOKEN') return accessToken;
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('ExpoNotificationsService', () => {
  it('skips sending for an invalid push token and does not throw', async () => {
    const svc = new ExpoNotificationsService(makeConfig());
    const sendSpy = jest.spyOn((svc as any).expo, 'sendPushNotificationsAsync');

    await expect(
      svc.sendToDevice('not-a-valid-expo-token', { title: 'T', body: 'B' }),
    ).resolves.not.toThrow();

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('calls expo.sendPushNotificationsAsync for a valid Expo push token', async () => {
    const svc = new ExpoNotificationsService(makeConfig('test-access-token'));

    const fakeTickets = [{ status: 'ok', id: 'ticket-123' }];
    const sendSpy = jest
      .spyOn((svc as any).expo, 'sendPushNotificationsAsync')
      .mockResolvedValue(fakeTickets as any);

    const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    await svc.sendToDevice(validToken, {
      title: 'Maintenance due: Oil change',
      body: 'Car needs maintenance in 1 day(s)',
      data: { reminderId: 'r1', itemId: 'i1', itemName: 'Car' },
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentMessages = sendSpy.mock.calls[0][0];
    expect(sentMessages[0].to).toBe(validToken);
    expect(sentMessages[0].title).toBe('Maintenance due: Oil change');
  });

  it('logs error ticket details without throwing', async () => {
    const svc = new ExpoNotificationsService(makeConfig());

    const errorTickets = [
      { status: 'error', message: 'InvalidCredentials', details: { error: 'InvalidCredentials' } },
    ];
    jest
      .spyOn((svc as any).expo, 'sendPushNotificationsAsync')
      .mockResolvedValue(errorTickets as any);

    const logSpy = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);

    const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    await expect(svc.sendToDevice(validToken, { title: 'T', body: 'B' })).resolves.not.toThrow();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('InvalidCredentials'),
    );
  });
});
