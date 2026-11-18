import { Bottle, Cellar, CellarBackupData, CellarReading, TastingEntry } from '../types/wine';

const STORAGE_KEY = 'la-cave-a-vin:v1';

export interface AppStateData {
  cellars: Cellar[];
  readings: CellarReading[];
  bottles: Bottle[];
  tastings: TastingEntry[];
}

export function createSeedData(): AppStateData {
  const now = new Date();
  const currentYear = now.getFullYear();

  const mainCellarId = 'cellar_principale';
  const serviceCellarId = 'cellar_service';

  const cellars: Cellar[] = [
    {
      id: mainCellarId,
      name: 'Cave principale',
      location: 'Sous-sol',
      capacity: 150,
      rackRows: 5,
      rackCols: 6,
      idealTempMin: 11,
      idealTempMax: 14,
      idealHumidityMin: 65,
      idealHumidityMax: 80,
      createdAt: now.toISOString(),
    },
    {
      id: serviceCellarId,
      name: 'Cave de service',
      location: 'Cuisine',
      capacity: 36,
      rackRows: 3,
      rackCols: 4,
      idealTempMin: 8,
      idealTempMax: 13,
      idealHumidityMin: 60,
      idealHumidityMax: 75,
      createdAt: now.toISOString(),
    },
  ];

  const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();

  const readings: CellarReading[] = [
    {
      id: 'read_1',
      cellarId: mainCellarId,
      temperature: 12.4,
      humidity: 72,
      recordedAt: twoHoursAgo,
      note: 'Relevé stable',
    },
    {
      id: 'read_2',
      cellarId: mainCellarId,
      temperature: 12.1,
      humidity: 71,
      recordedAt: twoDaysAgo,
    },
    {
      id: 'read_3',
      cellarId: serviceCellarId,
      temperature: 10.5,
      humidity: 64,
      recordedAt: twoHoursAgo,
      note: 'Prête pour le service',
    },
  ];

  const bottles: Bottle[] = [
    {
      id: 'bot_1',
      cellarId: mainCellarId,
      name: 'Château Sociando-Mallet',
      color: 'rouge',
      vintage: currentYear - 7,
      appellation: 'Haut-Médoc, Bordeaux',
      quantity: 6,
      rackLocation: 'Casier A2',
      purchasePrice: 38,
      estimatedCurrentPrice: 52,
      drinkFrom: currentYear - 1,
      drinkTo: currentYear + 5,
      maxKeepYears: 15,
      foodPairings: ['Côte de bœuf', 'Magret de canard', 'Comté affiné'],
      notes: 'Tanins encore présents, idéal sur côte de bœuf.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'bot_2',
      cellarId: mainCellarId,
      name: 'Domaine Leflaive — Les Clavoillons',
      color: 'blanc',
      vintage: currentYear - 4,
      appellation: 'Puligny-Montrachet 1er Cru, Bourgogne',
      quantity: 3,
      rackLocation: 'Casier B1',
      purchasePrice: 165,
      estimatedCurrentPrice: 240,
      drinkFrom: currentYear + 1,
      drinkTo: currentYear + 8,
      maxKeepYears: 12,
      foodPairings: ['Turbot rôti', 'Homard grillé', 'Volaille à la crème'],
      notes: 'À laisser encore patienter en cave.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'bot_3',
      cellarId: serviceCellarId,
      name: 'Billecart-Salmon Brut Rosé',
      color: 'champagne',
      appellation: 'Champagne',
      quantity: 2,
      rackLocation: 'Étagère 1',
      purchasePrice: 72,
      drinkFrom: currentYear,
      drinkTo: currentYear + 1,
      notes: 'Parfait pour l’apéritif ou un dessert aux fruits rouges.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'bot_4',
      cellarId: serviceCellarId,
      name: 'Château Minuty — Rose et Or',
      color: 'rose',
      vintage: currentYear - 2,
      appellation: 'Côtes de Provence',
      quantity: 4,
      rackLocation: 'Étagère 2',
      purchasePrice: 29,
      drinkFrom: currentYear - 1,
      drinkTo: currentYear,
      maxKeepYears: 2,
      notes: 'À déguster frais cet été.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  const tastings: TastingEntry[] = [
    {
      id: 'taste_1',
      bottleId: 'bot_1',
      bottleName: 'Château Sociando-Mallet',
      appellation: 'Haut-Médoc, Bordeaux',
      vintage: currentYear - 7,
      color: 'rouge',
      cellarId: mainCellarId,
      rating: 4.5,
      tastedAt: twoDaysAgo,
      occasion: 'Dîner entre amis',
      foodPairing: 'Côte de bœuf maturée',
      notes: 'Nez de cassis et cèdre, belle longueur, tanins soyeux après 1h de carafe.',
    },
  ];

  return { cellars, readings, bottles, tastings };
}

export function loadAppData(): AppStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedData();
      saveAppData(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as Partial<AppStateData>;
    return {
      cellars: Array.isArray(parsed.cellars) ? parsed.cellars : [],
      readings: Array.isArray(parsed.readings) ? parsed.readings : [],
      bottles: Array.isArray(parsed.bottles) ? parsed.bottles : [],
      tastings: Array.isArray(parsed.tastings) ? parsed.tastings : [],
    };
  } catch {
    return createSeedData();
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
