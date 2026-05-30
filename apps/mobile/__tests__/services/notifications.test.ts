/**
 * Component/integration tests for push notification service logic.
 * All native modules are mocked — no device or emulator required.
 * Covers DXS-140: token registration, handler deep-link, permission denied fallback.
 */

// ── Module mocks (hoisted before imports) ────────────────────────────────────

// Mutable container — the factory closes over this so tests can change isDevice.
// Note: jest.mock is hoisted by the babel-jest transform, so this const declaration
// is visible to the factory when the module is first required.
const deviceState = { isDevice: true };

jest.mock('expo-device', () => ({
  get isDevice() { return deviceState.isDevice; },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('../../services/remindersApi', () => ({
  remindersApi: {
    registerDeviceToken: jest.fn(),
  },
}));

// ── Imports (resolved against mocks above) ───────────────────────────────────

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {
  registerDeviceForPushNotifications,
  createNotificationTapSubscription,
} from '../../services/notifications';
import { remindersApi } from '../../services/remindersApi';

// ── Typed helpers ────────────────────────────────────────────────────────────

const mockNotif = Notifications as jest.Mocked<typeof Notifications>;
const mockStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockApi = remindersApi as jest.Mocked<typeof remindersApi>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TOKEN = 'ExponentPushToken[abc123]';

function makeResponse(status: 'granted' | 'denied' | 'undetermined') {
  return { status, granted: status === 'granted', canAskAgain: true, expires: 'never' as const };
}

function makeTapResponse(data: Record<string, unknown>) {
  return {
    notification: {
      request: {
        identifier: 'req-1',
        content: { title: 'Test', body: 'Body', data, sound: null, badge: null },
        trigger: { type: 'push' as const },
      },
      date: Date.now(),
    },
    actionIdentifier: 'default',
  };
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('registerDeviceForPushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deviceState.isDevice = true;
    mockStore.setItemAsync.mockResolvedValue(undefined);
    mockApi.registerDeviceToken.mockResolvedValue(undefined as any);
    mockNotif.setNotificationChannelAsync.mockResolvedValue(null as any);
  });

  it('sends token to backend and caches it when permission granted and token is new', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue(makeResponse('granted'));
    mockNotif.getDevicePushTokenAsync.mockResolvedValue({ type: 'ios', data: TOKEN });
    mockStore.getItemAsync.mockResolvedValue(null);

    await registerDeviceForPushNotifications();

    expect(mockApi.registerDeviceToken).toHaveBeenCalledWith(TOKEN);
    expect(mockStore.setItemAsync).toHaveBeenCalledWith('last_registered_push_token', TOKEN);
  });

  it('requests permission when status is undetermined, then registers', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue(makeResponse('undetermined'));
    mockNotif.requestPermissionsAsync.mockResolvedValue(makeResponse('granted'));
    mockNotif.getDevicePushTokenAsync.mockResolvedValue({ type: 'ios', data: TOKEN });
    mockStore.getItemAsync.mockResolvedValue(null);

    await registerDeviceForPushNotifications();

    expect(mockNotif.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockApi.registerDeviceToken).toHaveBeenCalledWith(TOKEN);
  });

  it('skips API call when stored token matches current token (dedup)', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue(makeResponse('granted'));
    mockNotif.getDevicePushTokenAsync.mockResolvedValue({ type: 'ios', data: TOKEN });
    mockStore.getItemAsync.mockResolvedValue(TOKEN);

    await registerDeviceForPushNotifications();

    expect(mockApi.registerDeviceToken).not.toHaveBeenCalled();
    expect(mockStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('does not register when permission is denied (fallback: silent)', async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue(makeResponse('denied'));
    mockNotif.requestPermissionsAsync.mockResolvedValue(makeResponse('denied'));

    await registerDeviceForPushNotifications();

    expect(mockApi.registerDeviceToken).not.toHaveBeenCalled();
    expect(mockStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('does not request token on simulator/emulator (Device.isDevice === false)', async () => {
    deviceState.isDevice = false;

    await registerDeviceForPushNotifications();

    expect(mockNotif.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockApi.registerDeviceToken).not.toHaveBeenCalled();
  });

  it('swallows errors without throwing so the app stays alive', async () => {
    mockNotif.getPermissionsAsync.mockRejectedValue(new Error('native crash'));

    await expect(registerDeviceForPushNotifications()).resolves.toBeUndefined();
    expect(mockApi.registerDeviceToken).not.toHaveBeenCalled();
  });
});

describe('createNotificationTapSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupListener() {
    let capturedCallback: ((r: ReturnType<typeof makeTapResponse>) => void) | null = null;
    const mockSubscription = { remove: jest.fn() };
    mockNotif.addNotificationResponseReceivedListener.mockImplementation((cb) => {
      capturedCallback = cb as typeof capturedCallback;
      return mockSubscription as any;
    });
    return { capturedCallback: () => capturedCallback!, mockSubscription };
  }

  it('calls onItemReminderTap with itemId when notification payload has a valid itemId', () => {
    const { capturedCallback } = setupListener();
    const onTap = jest.fn();

    createNotificationTapSubscription(onTap);
    capturedCallback()!(makeTapResponse({ itemId: 'asset-42' }));

    expect(onTap).toHaveBeenCalledWith('asset-42');
  });

  it('does not call onItemReminderTap when notification data has no itemId', () => {
    const { capturedCallback } = setupListener();
    const onTap = jest.fn();

    createNotificationTapSubscription(onTap);
    capturedCallback()!(makeTapResponse({ type: 'marketing' }));

    expect(onTap).not.toHaveBeenCalled();
  });

  it('does not call onItemReminderTap when itemId is an empty string', () => {
    const { capturedCallback } = setupListener();
    const onTap = jest.fn();

    createNotificationTapSubscription(onTap);
    capturedCallback()!(makeTapResponse({ itemId: '' }));

    expect(onTap).not.toHaveBeenCalled();
  });

  it('does not call onItemReminderTap when itemId is a non-string value', () => {
    const { capturedCallback } = setupListener();
    const onTap = jest.fn();

    createNotificationTapSubscription(onTap);
    capturedCallback()!(makeTapResponse({ itemId: 99 }));

    expect(onTap).not.toHaveBeenCalled();
  });

  it('returns a subscription object with a remove method', () => {
    const { mockSubscription } = setupListener();
    const onTap = jest.fn();

    const sub = createNotificationTapSubscription(onTap);

    expect(sub).toBe(mockSubscription);
    expect(typeof sub.remove).toBe('function');
  });
});
