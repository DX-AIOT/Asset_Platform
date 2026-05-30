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

    const result = await svc.sendToDevice('not-a-valid-expo-token', { title: 'T', body: 'B' });

    expect(result.deadTokens).toEqual([]);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('calls expo.sendPushNotificationsAsync for a valid Expo push token', async () => {
    const svc = new ExpoNotificationsService(makeConfig('test-access-token'));

    const fakeTickets = [{ status: 'ok', id: 'ticket-123' }];
    const sendSpy = jest
      .spyOn((svc as any).expo, 'sendPushNotificationsAsync')
      .mockResolvedValue(fakeTickets as any);

    const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    const result = await svc.sendToDevice(validToken, {
      title: 'Maintenance due: Oil change',
      body: 'Car needs maintenance in 1 day(s)',
      data: { reminderId: 'r1', itemId: 'i1', itemName: 'Car' },
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentMessages = sendSpy.mock.calls[0][0];
    expect(sentMessages[0].to).toBe(validToken);
    expect(sentMessages[0].title).toBe('Maintenance due: Oil change');
    expect(result.deadTokens).toEqual([]);
  });

  it('includes data field in the sent message', async () => {
    const svc = new ExpoNotificationsService(makeConfig('test-access-token'));
    const fakeTickets = [{ status: 'ok', id: 'ticket-456' }];
    const sendSpy = jest
      .spyOn((svc as any).expo, 'sendPushNotificationsAsync')
      .mockResolvedValue(fakeTickets as any);

    const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    await svc.sendToDevice(validToken, {
      title: 'Test',
      body: 'Test body',
      data: { reminderId: 'rem-1', itemId: 'itm-1', itemName: 'Fridge' },
    });

    const sentMessage = sendSpy.mock.calls[0][0][0];
    expect(sentMessage.data).toEqual({ reminderId: 'rem-1', itemId: 'itm-1', itemName: 'Fridge' });
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

  it('returns the dead token when Expo reports DeviceNotRegistered', async () => {
    const svc = new ExpoNotificationsService(makeConfig('test-token'));

    const deviceNotRegisteredTickets = [
      {
        status: 'error',
        message: 'The device cannot be reached',
        details: { error: 'DeviceNotRegistered' },
      },
    ];
    jest
      .spyOn((svc as any).expo, 'sendPushNotificationsAsync')
      .mockResolvedValue(deviceNotRegisteredTickets as any);

    const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    const result = await svc.sendToDevice(validToken, { title: 'T', body: 'B' });

    expect(result.deadTokens).toEqual([validToken]);
  });

  it('returns empty deadTokens for non-DeviceNotRegistered errors', async () => {
    const svc = new ExpoNotificationsService(makeConfig('test-token'));

    const otherErrorTickets = [
      {
        status: 'error',
        message: 'Something else failed',
        details: { error: 'MessageRateExceeded' },
      },
    ];
    jest
      .spyOn((svc as any).expo, 'sendPushNotificationsAsync')
      .mockResolvedValue(otherErrorTickets as any);

    const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
    const result = await svc.sendToDevice(validToken, { title: 'T', body: 'B' });

    expect(result.deadTokens).toEqual([]);
  });
});
