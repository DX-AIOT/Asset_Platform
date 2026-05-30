/**
 * Integration tests for the AppLayout push-notification wiring.
 * Verifies that: the layout registers for push on mount, creates the tap
 * subscription, navigates to the item deep-link on tap, and tears down the
 * subscription on unmount — all without a real device.
 *
 * Uses react-test-renderer (no React Native runtime needed) since every
 * external dependency is mocked — the rendered tree is just null nodes.
 */

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  Stack: Object.assign(
    function Stack({ children }: { children: React.ReactNode }) { return children as any; },
    { Screen: function Screen() { return null; } },
  ),
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockRegister = jest.fn();
const mockCreateSubscription = jest.fn();

jest.mock('../../services/notifications', () => ({
  registerDeviceForPushNotifications: mockRegister,
  createNotificationTapSubscription: mockCreateSubscription,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from 'react';
import { act, create } from 'react-test-renderer';
import AppLayout from '../../app/(app)/_layout';
import { useAuth } from '../../contexts/AuthContext';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AppLayout — notification integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue(undefined);
  });

  it('calls registerDeviceForPushNotifications when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as any);
    const mockSub = { remove: jest.fn() };
    mockCreateSubscription.mockReturnValue(mockSub);

    act(() => { create(<AppLayout />); });

    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('does not register when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false } as any);

    act(() => { create(<AppLayout />); });

    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockCreateSubscription).not.toHaveBeenCalled();
  });

  it('creates a tap subscription when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as any);
    const mockSub = { remove: jest.fn() };
    mockCreateSubscription.mockReturnValue(mockSub);

    act(() => { create(<AppLayout />); });

    expect(mockCreateSubscription).toHaveBeenCalledTimes(1);
    expect(typeof mockCreateSubscription.mock.calls[0][0]).toBe('function');
  });

  it('navigates to /item/[id] when the tap subscription callback fires with an itemId', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as any);
    let capturedTapCallback: ((itemId: string) => void) | null = null;
    const mockSub = { remove: jest.fn() };
    mockCreateSubscription.mockImplementation((cb: (id: string) => void) => {
      capturedTapCallback = cb;
      return mockSub;
    });

    act(() => { create(<AppLayout />); });

    expect(capturedTapCallback).not.toBeNull();
    capturedTapCallback!('item-99');

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/item/[id]',
      params: { id: 'item-99' },
    });
  });

  it('removes the tap subscription on unmount', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as any);
    const mockSub = { remove: jest.fn() };
    mockCreateSubscription.mockReturnValue(mockSub);

    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<AppLayout />); });
    act(() => { renderer!.unmount(); });

    expect(mockSub.remove).toHaveBeenCalledTimes(1);
  });

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false } as any);

    act(() => { create(<AppLayout />); });

    expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});
