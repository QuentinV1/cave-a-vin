export type WineColor = 'rouge' | 'blanc' | 'rose' | 'champagne' | 'autre';

export type TastingStatus = 'a_garder' | 'apogee' | 'urgent' | 'inconnu';

export interface Cellar {
  id: string;
  name: string;
  location?: string;
  capacity?: number;
  rackRows?: number;
  rackCols?: number;
  idealTempMin: number;
  idealTempMax: number;
  idealHumidityMin: number;
  idealHumidityMax: number;
  createdAt: string;
}

export interface CellarReading {
  id: string;
  cellarId: string;
  temperature: number;
  humidity: number;
  recordedAt: string;
  note?: string;
}

export interface Bottle {
  id: string;
  cellarId: string;
  name: string;
  color: WineColor;
  vintage?: number;
  appellation: string;
  quantity: number;
  rackLocation?: string;
  purchasePrice?: number;
  estimatedCurrentPrice?: number;
  drinkFrom?: number;
  drinkTo?: number;
  maxKeepYears?: number;
  foodPairings?: string[];
  barcode?: string;
  photoDataUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TastingEntry {
  id: string;
  bottleId?: string;
  bottleName: string;
  appellation?: string;
  vintage?: number;
  color: WineColor;
  cellarId?: string;
  rating: number;
  tastedAt: string;
  occasion?: string;
  foodPairing?: string;
  notes?: string;
}

export interface CellarBackupData {
  version: 1 | 2;
  exportedAt: string;
  cellars: Cellar[];
  readings: CellarReading[];
  bottles: Bottle[];
  tastings?: TastingEntry[];
}
