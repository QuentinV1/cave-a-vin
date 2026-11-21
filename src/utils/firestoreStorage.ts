import {
  collection,
  doc,
  DocumentReference,
  getDocs,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { Bottle, Cellar, CellarReading, TastingEntry, WineColor } from '../types/wine';
import { db, estConnecteFirebase, getFirebaseUser } from './firebase';
import { AppStateData, saveAppData } from './storage';

const BATCH_LIMIT = 450;
export const LAST_UID_KEY = 'cave_a_vin_last_uid';
const MAX_FIRESTORE_PHOTO_LENGTH = 480_000;

export type SyncCollectionKey = keyof AppStateData; // 'cellars' | 'readings' | 'bottles' | 'tastings'

const SYNC_COLLECTIONS: SyncCollectionKey[] = [
  'cellars',
  'readings',
  'bottles',
  'tastings',
];

export interface CloudState {
  initialSyncDone: boolean;
  syncedCols: Record<string, boolean>;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  syncError: string | null;
  lastSyncedAt: string | null;
}

export const cloudState: CloudState = {
  initialSyncDone: false,
  syncedCols: {},
  syncStatus: 'idle',
  syncError: null,
  lastSyncedAt: null,
};

type CloudStateListener = (state: CloudState) => void;
const cloudStateListeners = new Set<CloudStateListener>();

function emitCloudState() {
  const snapshot: CloudState = {
    ...cloudState,
    syncedCols: { ...cloudState.syncedCols },
  };
  cloudStateListeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeCloudState(listener: CloudStateListener): () => void {
  cloudStateListeners.add(listener);
  listener({
    ...cloudState,
    syncedCols: { ...cloudState.syncedCols },
  });
  return () => {
    cloudStateListeners.delete(listener);
  };
}

export function reinitialiserEtatCloud(): void {
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
  }
  cloudState.initialSyncDone = false;
  cloudState.syncedCols = {};
  cloudState.syncStatus = 'idle';
  cloudState.syncError = null;
  cloudState.lastSyncedAt = null;
  emitCloudState();
}

let unsubListeners: Array<() => void> = [];
let _suppressCloudSync = false;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

export function isSuppressingCloudSync(): boolean {
  return _suppressCloudSync;
}

export function arreterListenersFirestore(): void {
  unsubListeners.forEach((unsub) => {
    try {
      unsub();
    } catch {
      // Ignore
    }
  });
  unsubListeners = [];
}

/**
 * Strip `undefined` (and `null`) optional properties before writing to Firestore.
 * Also cleans nested arrays so no `undefined` is ever sent to Firestore.
 */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.map((item) => (item === undefined ? null : item));
      } else {
        result[key] = value;
      }
    }
  }
  return result as Partial<T>;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z?$/;
const VALID_WINE_COLORS: WineColor[] = ['rouge', 'blanc', 'rose', 'champagne', 'autre'];

function normalizeIsoDate(value: unknown, fallbackIso?: string): string {
  if (
    typeof value === 'string' &&
    value.length <= 64 &&
    ISO_DATE_REGEX.test(value)
  ) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallbackIso || new Date().toISOString();
}

export function sanitizeCellarForFirestore(
  cellar: Cellar,
  existingCreatedAt?: string,
): Record<string, unknown> {
  const id = String(cellar.id).slice(0, 128);
  const createdAt = existingCreatedAt
    ? normalizeIsoDate(existingCreatedAt)
    : normalizeIsoDate(cellar.createdAt);

  const docData: Cellar = {
    id,
    name: String(cellar.name || 'Cave').slice(0, 120),
    location:
      typeof cellar.location === 'string'
        ? cellar.location.slice(0, 120)
        : undefined,
    capacity:
      typeof cellar.capacity === 'number' &&
      Number.isFinite(cellar.capacity) &&
      cellar.capacity >= 0
        ? cellar.capacity
        : undefined,
    rackRows:
      typeof cellar.rackRows === 'number' &&
      Number.isFinite(cellar.rackRows) &&
      cellar.rackRows >= 1 &&
      cellar.rackRows <= 50
        ? Math.round(cellar.rackRows)
        : undefined,
    rackCols:
      typeof cellar.rackCols === 'number' &&
      Number.isFinite(cellar.rackCols) &&
      cellar.rackCols >= 1 &&
      cellar.rackCols <= 50
        ? Math.round(cellar.rackCols)
        : undefined,
    idealTempMin: Number.isFinite(cellar.idealTempMin) ? cellar.idealTempMin : 11,
    idealTempMax: Number.isFinite(cellar.idealTempMax) ? cellar.idealTempMax : 14,
    idealHumidityMin: Number.isFinite(cellar.idealHumidityMin)
      ? cellar.idealHumidityMin
      : 65,
    idealHumidityMax: Number.isFinite(cellar.idealHumidityMax)
      ? cellar.idealHumidityMax
      : 80,
    createdAt,
  };

  return stripUndefined(docData) as Record<string, unknown>;
}

export function sanitizeReadingForFirestore(
  reading: CellarReading,
): Record<string, unknown> {
  const id = String(reading.id).slice(0, 128);
  const docData: CellarReading = {
    id,
    cellarId: String(reading.cellarId || 'cellar_principale').slice(0, 128),
    temperature: Number.isFinite(reading.temperature) ? reading.temperature : 12,
    humidity: Number.isFinite(reading.humidity)
      ? Math.min(100, Math.max(0, reading.humidity))
      : 70,
    recordedAt: normalizeIsoDate(reading.recordedAt),
    note:
      typeof reading.note === 'string' ? reading.note.slice(0, 500) : undefined,
  };

  return stripUndefined(docData) as Record<string, unknown>;
}

export function sanitizeBottleForFirestore(
  bottle: Bottle,
  existingCreatedAt?: string,
): Record<string, unknown> {
  const id = String(bottle.id).slice(0, 128);
  const createdAt = existingCreatedAt
    ? normalizeIsoDate(existingCreatedAt)
    : normalizeIsoDate(bottle.createdAt);
  const updatedAt = normalizeIsoDate(bottle.updatedAt, createdAt);

  const color: WineColor = VALID_WINE_COLORS.includes(bottle.color)
    ? bottle.color
    : 'rouge';

  const foodPairings = Array.isArray(bottle.foodPairings)
    ? bottle.foodPairings
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 100))
        .slice(0, 30)
    : undefined;

  const docData: Bottle = {
    id,
    cellarId: String(bottle.cellarId || 'cellar_principale').slice(0, 128),
    name: String(bottle.name || 'Vin').slice(0, 200),
    color,
    vintage:
      typeof bottle.vintage === 'number' && Number.isFinite(bottle.vintage)
        ? Math.round(bottle.vintage)
        : undefined,
    appellation: String(bottle.appellation ?? '').slice(0, 200),
    quantity:
      typeof bottle.quantity === 'number' &&
      Number.isFinite(bottle.quantity) &&
      bottle.quantity >= 0
        ? Math.round(bottle.quantity)
        : 0,
    rackLocation:
      typeof bottle.rackLocation === 'string'
        ? bottle.rackLocation.slice(0, 100)
        : undefined,
    purchasePrice:
      typeof bottle.purchasePrice === 'number' &&
      Number.isFinite(bottle.purchasePrice) &&
      bottle.purchasePrice >= 0
        ? bottle.purchasePrice
        : undefined,
    estimatedCurrentPrice:
      typeof bottle.estimatedCurrentPrice === 'number' &&
      Number.isFinite(bottle.estimatedCurrentPrice) &&
      bottle.estimatedCurrentPrice >= 0
        ? bottle.estimatedCurrentPrice
        : undefined,
    drinkFrom:
      typeof bottle.drinkFrom === 'number' && Number.isFinite(bottle.drinkFrom)
        ? Math.round(bottle.drinkFrom)
        : undefined,
    drinkTo:
      typeof bottle.drinkTo === 'number' && Number.isFinite(bottle.drinkTo)
        ? Math.round(bottle.drinkTo)
        : undefined,
    maxKeepYears:
      typeof bottle.maxKeepYears === 'number' &&
      Number.isFinite(bottle.maxKeepYears) &&
      bottle.maxKeepYears >= 0
        ? Math.round(bottle.maxKeepYears)
        : undefined,
    foodPairings: foodPairings && foodPairings.length > 0 ? foodPairings : undefined,
    barcode:
      typeof bottle.barcode === 'string'
        ? bottle.barcode.slice(0, 64)
        : undefined,
    photoDataUrl:
      typeof bottle.photoDataUrl === 'string' &&
      bottle.photoDataUrl.length <= MAX_FIRESTORE_PHOTO_LENGTH
        ? bottle.photoDataUrl
        : undefined,
    notes:
      typeof bottle.notes === 'string' ? bottle.notes.slice(0, 2000) : undefined,
    createdAt,
    updatedAt,
  };

  return stripUndefined(docData) as Record<string, unknown>;
}

export function sanitizeTastingForFirestore(
  tasting: TastingEntry,
): Record<string, unknown> {
  const id = String(tasting.id).slice(0, 128);
  const color: WineColor = VALID_WINE_COLORS.includes(tasting.color)
    ? tasting.color
    : 'rouge';

  const docData: TastingEntry = {
    id,
    bottleId:
      typeof tasting.bottleId === 'string'
        ? tasting.bottleId.slice(0, 128)
        : undefined,
    bottleName: String(tasting.bottleName || 'Vin').slice(0, 200),
    appellation:
      typeof tasting.appellation === 'string'
        ? tasting.appellation.slice(0, 200)
        : undefined,
    vintage:
      typeof tasting.vintage === 'number' && Number.isFinite(tasting.vintage)
        ? Math.round(tasting.vintage)
        : undefined,
    color,
    cellarId:
      typeof tasting.cellarId === 'string'
        ? tasting.cellarId.slice(0, 128)
        : undefined,
    rating:
      typeof tasting.rating === 'number' && Number.isFinite(tasting.rating)
        ? Math.min(5, Math.max(0, tasting.rating))
        : 3,
    tastedAt: normalizeIsoDate(tasting.tastedAt),
    occasion:
      typeof tasting.occasion === 'string'
        ? tasting.occasion.slice(0, 200)
        : undefined,
    foodPairing:
      typeof tasting.foodPairing === 'string'
        ? tasting.foodPairing.slice(0, 200)
        : undefined,
    notes:
      typeof tasting.notes === 'string'
        ? tasting.notes.slice(0, 2000)
        : undefined,
  };

  return stripUndefined(docData) as Record<string, unknown>;
}

export function formatFirestoreSyncError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  if (code === 'permission-denied' || (err instanceof Error && err.message.includes('Missing or insufficient permissions'))) {
    return 'Accès Firestore refusé (vérifiez que votre e-mail est bien vérifié et autorisé).';
  }
  return err instanceof Error ? err.message : 'Erreur de synchronisation Firestore';
}

export function demarrerSyncFirestore({
  onCollectionUpdate,
  onSyncError,
}: {
  onCollectionUpdate: (
    colName: SyncCollectionKey,
    list: unknown[],
    fromCache: boolean,
  ) => void;
  onSyncError: (err: unknown, label: string) => void;
}): void {
  arreterListenersFirestore();
  const user = getFirebaseUser();
  if (!db || !user) return;

  const uid = user.uid;

  SYNC_COLLECTIONS.forEach((colName) => {
    const colRef = collection(db!, 'users', uid, colName);
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        onCollectionUpdate(colName, list, snap.metadata.fromCache);
      },
      (err) => {
        console.warn(`Sync ${colName}:`, err);
        onSyncError(err, colName);
      },
    );
    unsubListeners.push(unsub);
  });
}

export async function syncAllUserDataToFirestore(appData: AppStateData): Promise<void> {
  const user = getFirebaseUser();
  if (!db || !user) return;
  const uid = user.uid;

  type BatchOperation =
    | { type: 'delete'; ref: DocumentReference }
    | { type: 'set'; ref: DocumentReference; data: Record<string, unknown> };

  const mapping: Array<{
    colName: SyncCollectionKey;
    items: Array<{ id: string }>;
    sanitize: (item: never, existingCreatedAt?: string) => Record<string, unknown>;
  }> = [
    {
      colName: 'cellars',
      items: appData.cellars || [],
      sanitize: (item: Cellar, existingCreatedAt?: string) =>
        sanitizeCellarForFirestore(item, existingCreatedAt),
    },
    {
      colName: 'readings',
      items: appData.readings || [],
      sanitize: (item: CellarReading) => sanitizeReadingForFirestore(item),
    },
    {
      colName: 'bottles',
      items: appData.bottles || [],
      sanitize: (item: Bottle, existingCreatedAt?: string) =>
        sanitizeBottleForFirestore(item, existingCreatedAt),
    },
    {
      colName: 'tastings',
      items: appData.tastings || [],
      sanitize: (item: TastingEntry) => sanitizeTastingForFirestore(item),
    },
  ];

  for (const { colName, items, sanitize } of mapping) {
    const colRef = collection(db, 'users', uid, colName);
    const existingSnap = await getDocs(colRef);
    const existingCreatedAtById = new Map<string, string | undefined>();
    existingSnap.docs.forEach((d) => {
      const data = d.data() as { createdAt?: unknown };
      existingCreatedAtById.set(
        d.id,
        typeof data.createdAt === 'string' ? data.createdAt : undefined,
      );
    });

    const validItems = items.filter((item) => item && item.id);
    const currentIds = new Set(validItems.map((item) => String(item.id)));

    const ops: BatchOperation[] = [];

    existingSnap.docs.forEach((d) => {
      if (!currentIds.has(d.id)) {
        ops.push({ type: 'delete', ref: d.ref });
      }
    });

    validItems.forEach((item) => {
      const docId = String(item.id);
      const existingCreatedAt = existingCreatedAtById.get(docId);
      const payload = sanitize(item as never, existingCreatedAt);
      ops.push({
        type: 'set',
        ref: doc(colRef, docId),
        data: payload,
      });
    });

    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + BATCH_LIMIT)) {
        if (op.type === 'delete') {
          batch.delete(op.ref);
        } else {
          batch.set(op.ref, op.data);
        }
      }
      await batch.commit();
    }
  }
}

export function planifierPushCloud(getLatestData: () => AppStateData): void {
  if (_suppressCloudSync || !estConnecteFirebase() || !cloudState.initialSyncDone) {
    return;
  }
  if (_syncTimer) {
    clearTimeout(_syncTimer);
  }
  cloudState.syncStatus = 'syncing';
  cloudState.syncError = null;
  emitCloudState();

  _syncTimer = setTimeout(async () => {
    try {
      await syncAllUserDataToFirestore(getLatestData());
      cloudState.syncStatus = 'synced';
      cloudState.lastSyncedAt = new Date().toISOString();
      emitCloudState();
    } catch (err) {
      console.warn('Sync Firestore:', err);
      cloudState.syncStatus = 'error';
      cloudState.syncError = formatFirestoreSyncError(err);
      emitCloudState();
    }
  }, 450);
}

export function activerSyncCloud(
  getLocalData: () => AppStateData,
  applyLocalDataFromCloud: (nextData: AppStateData) => void,
): void {
  if (!estConnecteFirebase()) return;
  reinitialiserEtatCloud();
  cloudState.syncStatus = 'syncing';
  emitCloudState();

  const user = getFirebaseUser();
  const currentUid = user ? user.uid : null;
  const previousUid =
    typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_UID_KEY) : null;
  const isNewDeviceLogin = Boolean(currentUid && previousUid !== currentUid);
  let needsPushAfterInit = false;

  const mergeRemoteBottlesPreservingHeavyLocalPhotos = (
    remoteBottles: Bottle[],
    localBottles: Bottle[],
  ): Bottle[] => {
    const localPhotoById = new Map<string, string>();
    localBottles.forEach((b) => {
      if (b && b.id && b.photoDataUrl) {
        localPhotoById.set(String(b.id), b.photoDataUrl);
      }
    });
    return remoteBottles.map((rb) => {
      if (!rb.photoDataUrl && localPhotoById.has(String(rb.id))) {
        return { ...rb, photoDataUrl: localPhotoById.get(String(rb.id)) };
      }
      return rb;
    });
  };

  demarrerSyncFirestore({
    onCollectionUpdate: (colName, rawList, fromCache = false) => {
      const list = rawList as Array<{ id: string }>;

      // Ne jamais traiter un cache local vide comme un serveur vide
      if (fromCache && list.length === 0) {
        return;
      }

      const isFirstServerForCol = !fromCache && !cloudState.syncedCols[colName];
      const currentData = getLocalData();
      const localItems = (currentData[colName] || []) as Array<{ id: string }>;

      if (isFirstServerForCol) {
        cloudState.syncedCols[colName] = true;

        if (list.length === 0 && localItems.length > 0) {
          // Serveur réellement vide et données locales présentes : pousser vers le cloud après init complète
          needsPushAfterInit = true;
        } else if (list.length > 0 && localItems.length > 0 && isNewDeviceLogin) {
          // Première connexion sur cet appareil / ce compte : fusionner serveur + éléments locaux absents du serveur
          const serverIds = new Set(list.map((i) => String(i.id)));
          const localOnly = localItems.filter(
            (i) => i && i.id && !serverIds.has(String(i.id)),
          );
          let merged = [...list, ...localOnly];
          if (colName === 'bottles') {
            merged = mergeRemoteBottlesPreservingHeavyLocalPhotos(
              merged as Bottle[],
              localItems as Bottle[],
            );
          }
          _suppressCloudSync = true;
          const nextData: AppStateData = {
            ...currentData,
            [colName]: merged,
          };
          saveAppData(nextData);
          applyLocalDataFromCloud(nextData);
          _suppressCloudSync = false;

          if (localOnly.length > 0) {
            needsPushAfterInit = true;
          }
        } else {
          let finalList = list;
          if (colName === 'bottles') {
            finalList = mergeRemoteBottlesPreservingHeavyLocalPhotos(
              list as Bottle[],
              localItems as Bottle[],
            );
          }
          _suppressCloudSync = true;
          const nextData: AppStateData = {
            ...currentData,
            [colName]: finalList,
          };
          saveAppData(nextData);
          applyLocalDataFromCloud(nextData);
          _suppressCloudSync = false;
        }

        if (Object.keys(cloudState.syncedCols).length >= SYNC_COLLECTIONS.length) {
          cloudState.initialSyncDone = true;
          cloudState.syncStatus = 'synced';
          cloudState.lastSyncedAt = new Date().toISOString();
          if (currentUid && typeof localStorage !== 'undefined') {
            localStorage.setItem(LAST_UID_KEY, currentUid);
          }
          emitCloudState();

          if (needsPushAfterInit) {
            needsPushAfterInit = false;
            planifierPushCloud(getLocalData);
          }
        } else {
          emitCloudState();
        }
      } else {
        let finalList = list;
        if (colName === 'bottles') {
          finalList = mergeRemoteBottlesPreservingHeavyLocalPhotos(
            list as Bottle[],
            localItems as Bottle[],
          );
        }
        _suppressCloudSync = true;
        const nextData: AppStateData = {
          ...currentData,
          [colName]: finalList,
        };
        saveAppData(nextData);
        applyLocalDataFromCloud(nextData);
        _suppressCloudSync = false;
      }
    },
    onSyncError: (err) => {
      cloudState.syncStatus = 'error';
      cloudState.syncError = formatFirestoreSyncError(err);
      emitCloudState();
    },
  });
}

export async function forcerSyncCloud(appData: AppStateData): Promise<boolean> {
  if (!estConnecteFirebase()) {
    throw new Error('Non connecté au Cloud.');
  }
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
  }
  cloudState.syncStatus = 'syncing';
  cloudState.syncError = null;
  emitCloudState();

  try {
    await syncAllUserDataToFirestore(appData);
    cloudState.initialSyncDone = true;
    cloudState.syncStatus = 'synced';
    cloudState.lastSyncedAt = new Date().toISOString();
    const user = getFirebaseUser();
    if (user?.uid && typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_UID_KEY, user.uid);
    }
    emitCloudState();
    return true;
  } catch (err) {
    const formatted = formatFirestoreSyncError(err);
    cloudState.syncStatus = 'error';
    cloudState.syncError = formatted;
    emitCloudState();
    throw new Error(formatted);
  }
}
