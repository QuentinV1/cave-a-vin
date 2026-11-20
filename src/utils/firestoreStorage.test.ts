import { describe, expect, it } from 'vitest';
import { stripUndefined } from './firestoreStorage';

describe('firestoreStorage helpers', () => {
  it('strips undefined fields without mutating defined or falsy values', () => {
    const input = {
      id: 'bot_1',
      name: 'Margaux',
      vintage: undefined,
      quantity: 0,
      notes: '',
      photoDataUrl: undefined,
    };

    const cleaned = stripUndefined(input);
    expect(cleaned).toEqual({
      id: 'bot_1',
      name: 'Margaux',
      quantity: 0,
      notes: '',
    });
    expect('vintage' in cleaned).toBe(false);
    expect('photoDataUrl' in cleaned).toBe(false);
  });
});
