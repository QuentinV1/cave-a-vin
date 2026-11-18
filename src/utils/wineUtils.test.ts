import { describe, expect, it } from 'vitest';
import { Bottle, Cellar, CellarReading } from '../types/wine';
import {
  computeTastingStatus,
  evaluateReading,
  formatCurrency,
  generateId,
  getEffectiveDrinkTo,
} from './wineUtils';

const baseBottle: Bottle = {
  id: 'bot_test',
  cellarId: 'cellar_1',
  name: 'Château Test',
  color: 'rouge',
  appellation: 'Pauillac, Bordeaux',
  quantity: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('wineUtils', () => {
  describe('getEffectiveDrinkTo', () => {
    it('returns drinkTo when explicitly provided', () => {
      expect(getEffectiveDrinkTo({ ...baseBottle, drinkTo: 2032, vintage: 2020, maxKeepYears: 10 })).toBe(2032);
    });

    it('computes vintage + maxKeepYears when drinkTo is absent', () => {
      expect(getEffectiveDrinkTo({ ...baseBottle, vintage: 2020, maxKeepYears: 12 })).toBe(2032);
    });

    it('returns undefined when neither drinkTo nor vintage+maxKeepYears is set', () => {
      expect(getEffectiveDrinkTo(baseBottle)).toBeUndefined();
    });
  });

  describe('computeTastingStatus', () => {
    it('returns inconnu when no window is defined', () => {
      expect(computeTastingStatus(baseBottle, 2026).status).toBe('inconnu');
    });

    it('returns a_garder when currentYear < drinkFrom', () => {
      const res = computeTastingStatus({ ...baseBottle, drinkFrom: 2028, drinkTo: 2035 }, 2026);
      expect(res.status).toBe('a_garder');
    });

    it('returns apogee when within ideal window', () => {
      const res = computeTastingStatus({ ...baseBottle, drinkFrom: 2024, drinkTo: 2032 }, 2026);
      expect(res.status).toBe('apogee');
    });

    it('returns urgent when within 1 year of drinkTo or past drinkTo', () => {
      expect(computeTastingStatus({ ...baseBottle, drinkFrom: 2020, drinkTo: 2027 }, 2026).status).toBe('urgent');
      expect(computeTastingStatus({ ...baseBottle, drinkFrom: 2018, drinkTo: 2024 }, 2026).status).toBe('urgent');
    });
  });

  describe('evaluateReading', () => {
    const cellar: Cellar = {
      id: 'c1',
      name: 'Cave',
      idealTempMin: 11,
      idealTempMax: 14,
      idealHumidityMin: 65,
      idealHumidityMax: 80,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    it('returns ok when within ideal ranges', () => {
      const reading: CellarReading = {
        id: 'r1',
        cellarId: 'c1',
        temperature: 12.5,
        humidity: 72,
        recordedAt: '2026-01-01T00:00:00.000Z',
      };
      const res = evaluateReading(reading, cellar);
      expect(res.hasAlert).toBe(false);
      expect(res.tempStatus).toBe('ok');
      expect(res.humidityStatus).toBe('ok');
    });

    it('detects out-of-range temperature and humidity', () => {
      const reading: CellarReading = {
        id: 'r2',
        cellarId: 'c1',
        temperature: 18,
        humidity: 50,
        recordedAt: '2026-01-01T00:00:00.000Z',
      };
      const res = evaluateReading(reading, cellar);
      expect(res.hasAlert).toBe(true);
      expect(res.tempStatus).toBe('high');
      expect(res.humidityStatus).toBe('low');
      expect(res.messages).toHaveLength(2);
    });
  });

  it('formats currency in EUR and generates unique IDs', () => {
    expect(formatCurrency(42)).toContain('42');
    expect(formatCurrency(42)).toContain('€');
    expect(generateId('bot')).toMatch(/^bot_/);
  });
});
