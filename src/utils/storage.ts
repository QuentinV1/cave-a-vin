import { Bottle, Cellar, CellarBackupData, CellarReading, TastingEntry } from '../types/wine';

const STORAGE_KEY = 'la-cave-a-vin:v1';

export interface AppStateData {
  cellars: Cellar[];
  readings: CellarReading[];
  bottles: Bottle[];
  tastings: TastingEntry[];
}

export function createEmptyData(): AppStateData {
  return { cellars: [], readings: [], bottles: [], tastings: [] };
}

export function loadAppData(): AppStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyData();
    }
    const parsed = JSON.parse(raw) as Partial<AppStateData>;
    return {
      cellars: Array.isArray(parsed.cellars) ? parsed.cellars : [],
      readings: Array.isArray(parsed.readings) ? parsed.readings : [],
      bottles: Array.isArray(parsed.bottles) ? parsed.bottles : [],
      tastings: Array.isArray(parsed.tastings) ? parsed.tastings : [],
    };
  } catch {
    return createEmptyData();
  }
}

export function saveAppData(data: AppStateData): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'QuotaExceededError'
        ? 'Espace de stockage local saturé. Supprimez quelques photos ou exportez une sauvegarde.'
        : 'Impossible de sauvegarder les données localement.';
    return { ok: false, error: message };
  }
}

export function buildBackupPayload(data: AppStateData): CellarBackupData {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    cellars: data.cellars,
    readings: data.readings,
    bottles: data.bottles,
    tastings: data.tastings,
  };
}

export function parseBackupPayload(jsonText: string): CellarBackupData {
  const parsed = JSON.parse(jsonText) as Partial<CellarBackupData>;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.cellars) ||
    !Array.isArray(parsed.readings) ||
    !Array.isArray(parsed.bottles)
  ) {
    throw new Error('Format JSON invalide : champs cellars, readings et bottles requis.');
  }

  return {
    version: parsed.version === 2 ? 2 : 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    cellars: parsed.cellars,
    readings: parsed.readings,
    bottles: parsed.bottles,
    tastings: Array.isArray(parsed.tastings) ? parsed.tastings : [],
  };
}
