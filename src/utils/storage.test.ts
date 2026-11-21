import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppStateData,
  buildBackupPayload,
  createEmptyData,
  loadAppData,
  parseBackupPayload,
  saveAppData,
} from './storage';

const memoryStore = new Map<string, string>();
const mockLocalStorage: Storage = {
  get length() {
    return memoryStore.size;
  },
  clear: () => memoryStore.clear(),
  getItem: (key: string) => memoryStore.get(key) ?? null,
  key: (index: number) => Array.from(memoryStore.keys())[index] ?? null,
  removeItem: (key: string) => {
    memoryStore.delete(key);
  },
  setItem: (key: string, value: string) => {
    memoryStore.set(key, String(value));
  },
};

vi.stubGlobal('localStorage', mockLocalStorage);

const SAMPLE_DATA: AppStateData = {
  cellars: [
    {
      id: 'c1',
      name: 'Cave Test',
      location: 'Sous-sol',
      capacity: 50,
      rackRows: 3,
      rackCols: 4,
      idealTempMin: 11,
      idealTempMax: 14,
      idealHumidityMin: 65,
      idealHumidityMax: 80,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  readings: [
    {
      id: 'r1',
      cellarId: 'c1',
      temperature: 12.4,
      humidity: 72,
      recordedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  bottles: [
    {
      id: 'b1',
      cellarId: 'c1',
      name: 'Château Test',
      color: 'rouge',
      vintage: 2020,
      appellation: 'Bordeaux',
      quantity: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  tastings: [
    {
      id: 't1',
      bottleId: 'b1',
      bottleName: 'Château Test',
      color: 'rouge',
      cellarId: 'c1',
      rating: 4.5,
      tastedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates empty data by default', () => {
    const empty = createEmptyData();
    expect(empty).toEqual({ cellars: [], readings: [], bottles: [], tastings: [] });
  });

  it('loads empty state on empty localStorage and persists updates', () => {
    const initial = loadAppData();
    expect(initial.cellars).toEqual([]);

    const saveRes = saveAppData(SAMPLE_DATA);
    expect(saveRes.ok).toBe(true);

    const reloaded = loadAppData();
    expect(reloaded.tastings).toHaveLength(1);
    expect(reloaded.bottles).toHaveLength(1);
  });

  it('builds and parses v2 backup payloads and supports v1 backward compatibility', () => {
    const payload = buildBackupPayload(SAMPLE_DATA);
    expect(payload.version).toBe(2);

    const parsedV2 = parseBackupPayload(JSON.stringify(payload));
    expect(parsedV2.version).toBe(2);
    expect(parsedV2.tastings?.length).toBe(SAMPLE_DATA.tastings.length);

    const v1Json = JSON.stringify({
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      cellars: SAMPLE_DATA.cellars,
      readings: SAMPLE_DATA.readings,
      bottles: SAMPLE_DATA.bottles,
    });
    const parsedV1 = parseBackupPayload(v1Json);
    expect(parsedV1.version).toBe(1);
    expect(parsedV1.tastings).toEqual([]);
  });

  it('throws on invalid backup JSON', () => {
    expect(() => parseBackupPayload('{"foo":"bar"}')).toThrow();
  });
});
