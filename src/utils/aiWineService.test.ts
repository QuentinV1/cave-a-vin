import { describe, expect, it } from 'vitest';
import {
  estimateWinePriceLocally,
  estimateWineWindowLocally,
  suggestFoodPairingsLocally,
} from './aiWineService';

describe('aiWineService local estimations', () => {
  it('estimates long aging window and pairings for Grand Cru Pauillac', () => {
    const res = estimateWineWindowLocally({
      name: 'Château Pichon Longueville',
      color: 'rouge',
      appellation: 'Pauillac, Bordeaux',
      vintage: 2020,
    });
    expect(res.drinkFrom).toBe(2025);
    expect(res.drinkTo).toBeGreaterThanOrEqual(2036);
    expect(res.estimatedCurrentPrice).toBeGreaterThan(0);
    expect(res.foodPairings.length).toBeGreaterThan(0);
    expect(res.source).toBe('local');
  });

  it('keeps rosé window short and price flat', () => {
    const price = estimateWinePriceLocally({
      name: 'Minuty',
      color: 'rose',
      vintage: 2020,
      purchasePrice: 25,
    });
    expect(price).toBe(25);
    const pairings = suggestFoodPairingsLocally({ name: 'Minuty', color: 'rose' });
    expect(pairings).toContain('Grillades');
  });
});
