import { describe, expect, it } from 'vitest';
import {
  cloudState,
  formatFirestoreSyncError,
  reinitialiserEtatCloud,
  sanitizeBottleForFirestore,
  sanitizeCellarForFirestore,
  sanitizeReadingForFirestore,
  sanitizeTastingForFirestore,
  stripUndefined,
} from './firestoreStorage';

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

  it('sanitizes cellar documents and preserves existing createdAt', () => {
    const cellar = {
      id: 'cellar_1',
      name: 'Cave Principale',
      location: 'Sous-sol',
      capacity: 120,
      rackRows: 5,
      rackCols: 6,
      idealTempMin: 11,
      idealTempMax: 14,
      idealHumidityMin: 65,
      idealHumidityMax: 80,
      createdAt: '2026-11-21T10:00:00.000Z',
    };

    const payload = sanitizeCellarForFirestore(
      cellar,
      '2025-01-01T00:00:00.000Z',
    );
    expect(payload.id).toBe('cellar_1');
    expect(payload.createdAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('sanitizes bottle documents and strips oversized photoDataUrl (> 480 KB)', () => {
    const hugePhoto = 'data:image/webp;base64,' + 'A'.repeat(490_000);
    const bottle = {
      id: 'bot_99',
      cellarId: 'cellar_1',
      name: 'Pauillac',
      color: 'rouge' as const,
      appellation: 'Bordeaux',
      quantity: 3,
      photoDataUrl: hugePhoto,
      createdAt: '2026-11-21T10:00:00.000Z',
      updatedAt: '2026-11-21T10:05:00.000Z',
    };

    const payload = sanitizeBottleForFirestore(bottle);
    expect(payload.id).toBe('bot_99');
    expect('photoDataUrl' in payload).toBe(false);
  });

  it('sanitizes reading and tasting documents within Firestore rule bounds', () => {
    const reading = sanitizeReadingForFirestore({
      id: 'read_1',
      cellarId: 'cellar_1',
      temperature: 12.5,
      humidity: 72,
      recordedAt: '2026-11-21T10:00:00.000Z',
    });
    expect(reading.humidity).toBe(72);

    const tasting = sanitizeTastingForFirestore({
      id: 'taste_1',
      bottleName: 'Chablis',
      color: 'blanc',
      rating: 4.5,
      tastedAt: '2026-11-21T10:00:00.000Z',
    });
    expect(tasting.rating).toBe(4.5);
  });

  it('maps permission-denied error to explicit French message', () => {
    const msg = formatFirestoreSyncError({ code: 'permission-denied' });
    expect(msg).toBe(
      'Accès Firestore refusé (vérifiez que votre e-mail est bien vérifié et autorisé).',
    );
  });

  it('resets cloudState properly', () => {
    cloudState.initialSyncDone = true;
    cloudState.syncStatus = 'synced';
    cloudState.syncedCols = { bottles: true };
    reinitialiserEtatCloud();
    expect(cloudState.initialSyncDone).toBe(false);
    expect(cloudState.syncStatus).toBe('idle');
    expect(cloudState.syncedCols).toEqual({});
  });
});
