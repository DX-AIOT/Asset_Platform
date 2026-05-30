/**
 * Unit tests for reminder card rendering from notification payload data.
 * Verifies that title, interval, and due date from a reminder payload are
 * rendered correctly in the maintenance reminder section of ItemDetail.
 *
 * react-native is mocked with pass-through components so ts-jest can handle
 * the file without a Babel/Flow transform for the native runtime.
 */

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

// Stub react-native with pass-through components so we don't need a Flow/Babel transform.
jest.mock('react-native', () => {
  const React = require('react');
  const passThrough = (displayName: string) => {
    const C = ({ children, testID, style, ...rest }: any) =>
      React.createElement('div', { 'data-testid': testID, ...rest }, children);
    C.displayName = displayName;
    return C;
  };
  return {
    View: passThrough('View'),
    Text: passThrough('Text'),
    ScrollView: passThrough('ScrollView'),
    Image: passThrough('Image'),
    ActivityIndicator: passThrough('ActivityIndicator'),
    Pressable: passThrough('Pressable'),
    TextInput: passThrough('TextInput'),
    StyleSheet: { create: (s: any) => s },
    Dimensions: { get: () => ({ width: 375, height: 812 }) },
    Platform: { OS: 'ios' },
  };
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: 'item-1' })),
  Stack: Object.assign(
    function Stack({ children }: any) { return children; },
    { Screen: function Screen() { return null; } },
  ),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../services/itemsApi', () => ({
  itemsApi: {
    getItemById: jest.fn(),
    getPriceHistory: jest.fn(),
  },
}));

jest.mock('../../services/remindersApi', () => ({
  remindersApi: {
    listByItem: jest.fn(),
    create: jest.fn(),
    complete: jest.fn(),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from 'react';
import { act, create } from 'react-test-renderer';
import ItemDetail from '../../app/item/[id]';
import { itemsApi } from '../../services/itemsApi';
import { remindersApi } from '../../services/remindersApi';

const mockItemsApi = itemsApi as jest.Mocked<typeof itemsApi>;
const mockRemindersApi = remindersApi as jest.Mocked<typeof remindersApi>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ITEM = {
  id: 'item-1', name: 'HVAC Unit', brand: 'Carrier', category: 'appliance',
  condition: 'good', model: 'XR15', serial: null, location: null,
  purchasePrice: null, purchaseDate: null, warrantyExpiry: null, notes: null,
  photos: [], createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
};

const PRICE_HISTORY = { latestValue: null, points: [], trends: [] };

function makeReminder(overrides: Partial<{
  id: string; title: string; intervalDays: number; nextDueAt: string; notes: string | null;
}> = {}) {
  return {
    id: overrides.id ?? 'rem-1', itemId: 'item-1', userId: 'user-1',
    title: overrides.title ?? 'Filter replacement',
    intervalDays: overrides.intervalDays ?? 90,
    lastCompletedAt: null,
    nextDueAt: overrides.nextDueAt ?? '2026-07-01T00:00:00Z',
    notes: overrides.notes ?? null,
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
  };
}

/** Collect all text leaf strings from a react-test-renderer tree. */
function collectText(node: any): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (node.children) return collectText(node.children);
  return '';
}

function getRenderedText(root: ReturnType<typeof create>): string {
  return collectText(root.toJSON());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Reminder card UI — rendering from notification payload data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockItemsApi.getItemById.mockResolvedValue({ data: ITEM } as any);
    mockItemsApi.getPriceHistory.mockResolvedValue({ data: PRICE_HISTORY } as any);
  });

  it('renders reminder title from payload', async () => {
    mockRemindersApi.listByItem.mockResolvedValue({
      data: [makeReminder({ title: 'Replace air filter' })],
    } as any);

    let renderer: ReturnType<typeof create>;
    await act(async () => { renderer = create(<ItemDetail />); });

    expect(getRenderedText(renderer!)).toContain('Replace air filter');
  });

  it('renders interval from payload as "Every N day(s)"', async () => {
    mockRemindersApi.listByItem.mockResolvedValue({
      data: [makeReminder({ intervalDays: 30 })],
    } as any);

    let renderer: ReturnType<typeof create>;
    await act(async () => { renderer = create(<ItemDetail />); });

    expect(getRenderedText(renderer!)).toContain('Every 30 day(s)');
  });

  it('renders "Due …" text from payload nextDueAt', async () => {
    mockRemindersApi.listByItem.mockResolvedValue({
      data: [makeReminder({ nextDueAt: '2026-09-15T00:00:00Z' })],
    } as any);

    let renderer: ReturnType<typeof create>;
    await act(async () => { renderer = create(<ItemDetail />); });

    expect(getRenderedText(renderer!)).toMatch(/Due /);
  });

  it('renders optional notes from payload', async () => {
    mockRemindersApi.listByItem.mockResolvedValue({
      data: [makeReminder({ notes: 'Use HEPA filters only' })],
    } as any);

    let renderer: ReturnType<typeof create>;
    await act(async () => { renderer = create(<ItemDetail />); });

    expect(getRenderedText(renderer!)).toContain('Use HEPA filters only');
  });

  it('renders all reminders when multiple are present', async () => {
    mockRemindersApi.listByItem.mockResolvedValue({
      data: [
        makeReminder({ id: 'rem-1', title: 'Lubricate motor' }),
        makeReminder({ id: 'rem-2', title: 'Clean coils' }),
      ],
    } as any);

    let renderer: ReturnType<typeof create>;
    await act(async () => { renderer = create(<ItemDetail />); });

    const text = getRenderedText(renderer!);
    expect(text).toContain('Lubricate motor');
    expect(text).toContain('Clean coils');
  });

  it('shows empty state when no reminders are scheduled', async () => {
    mockRemindersApi.listByItem.mockResolvedValue({ data: [] } as any);

    let renderer: ReturnType<typeof create>;
    await act(async () => { renderer = create(<ItemDetail />); });

    expect(getRenderedText(renderer!)).toContain('No reminders scheduled yet.');
  });
});
