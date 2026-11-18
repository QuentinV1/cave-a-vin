// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildBackupPayload,
  createSeedData,
  loadAppData,
  parseBackupPayload,
  saveAppData,
} from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates seed data with cellars, readings, bottles and tastings', () => {
    const seed = createSeedData();
    expect(seed.cellars.length).toBeGreaterThanOrEqual(2);
    expect(seed.bottles.length).toBeGreaterThanOrEqual(4);
    expect(seed.readings.length).toBeGreaterThanOrEqual(2);
    expect(seed.tastings.length).toBeGreaterThanOrEqual(1);
  });

  it('loads seed data on empty localStorage and persists updates', () => {
    const initial = loadAppData();
    expect(initial.cellars.length).toBeGreaterThan(0);

    const updated = { ...initial, tastings: [] };
    const saveRes = saveAppData(updated);
    expect(saveRes.ok).toBe(true);

    const reloaded = loadAppData();
    expect(reloaded.tastings).toEqual([]);
    expect(reloaded.bottles.length).toBe(initial.bottles.length);
  });

  it('builds and parses v2 backup payloads and supports v1 backward compatibility', () => {
    const seed = createSeedData();
    const payload = buildBackupPayload(seed);
    expect(payload.version).toBe(2);

    const parsedV2 = parseBackupPayload(JSON.stringify(payload));
    expect(parsedV2.version).toBe(2);
    expect(parsedV2.tastings?.length).toBe(seed.tastings.length);

    const v1Json = JSON.stringify({
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      cellars: seed.cellars,
      readings: seed.readings,
      bottles: seed.bottles,
    });
    const parsedV1 = parseBackupPayload(v1Json);
    expect(parsedV1.version).toBe(1);
    expect(parsedV1.tastings).toEqual([]);
  });

  it('throws on invalid backup JSON', () => {
    expect(() => parseBackupPayload('{"foo":"bar"}')).toThrow();
  });
});
