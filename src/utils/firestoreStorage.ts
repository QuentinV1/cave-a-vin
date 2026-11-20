import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { Bottle, Cellar, CellarReading, TastingEntry } from '../types/wine';
import { db } from './firebase';
import { AppStateData } from './storage';

const BATCH_LIMIT = 450;

function requireDb() {
  if (!db) {
    throw new Error('Firebase Firestore non configuré.');
  }
  return db;
}

/**
 * Firestore rejects objects with `undefined` field values.
 * Strip undefined keys before calling `setDoc`.
 */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

export function subscribeUserData(
  uid: string,
  onData: (data: AppStateData, isInitialLoadComplete: boolean) => void,
  onError: (message: string) => void,
): () => void {
  const firestore = requireDb();

  let current: AppStateData = {
    cellars: [],
    readings: [],
    bottles: [],
    tastings: [],
  };
  const loadedCollections = new Set<keyof AppStateData>();

  const emit = (key: keyof AppStateData) => {
    loadedCollections.add(key);
    onData({ ...current }, loadedCollections.size === 4);
  };

  const handleError = (err: unknown) => {
    const msg =
      err instanceof Error
        ? `Erreur de synchronisation Firestore : ${err.message}`
        : 'Erreur de synchronisation avec la base de données.';
    onError(msg);
  };

  const unsubCellars = onSnapshot(
    collection(firestore, 'users', uid, 'cellars'),
    (snap) => {
      current = {
        ...current,
        cellars: snap.docs.map((d) => ({ ...(d.data() as Cellar), id: d.id })),
      };
      emit('cellars');
    },
    handleError,
  );

  const unsubReadings = onSnapshot(
    collection(firestore, 'users', uid, 'readings'),
    (snap) => {
      current = {
        ...current,
        readings: snap.docs.map((d) => ({ ...(d.data() as CellarReading), id: d.id })),
      };
      emit('readings');
    },
    handleError,
  );

  const unsubBottles = onSnapshot(
    collection(firestore, 'users', uid, 'bottles'),
    (snap) => {
      current = {
        ...current,
        bottles: snap.docs.map((d) => ({ ...(d.data() as Bottle), id: d.id })),
      };
      emit('bottles');
    },
    handleError,
  );

  const unsubTastings = onSnapshot(
    collection(firestore, 'users', uid, 'tastings'),
    (snap) => {
      current = {
        ...current,
        tastings: snap.docs.map((d) => ({ ...(d.data() as TastingEntry), id: d.id })),
      };
      emit('tastings');
    },
    handleError,
  );

  return () => {
    unsubCellars();
    unsubReadings();
    unsubBottles();
    unsubTastings();
  };
}

export async function saveCellarToCloud(uid: string, cellar: Cellar): Promise<void> {
  const firestore = requireDb();
  await setDoc(doc(firestore, 'users', uid, 'cellars', cellar.id), stripUndefined(cellar));
}

export async function deleteCellarFromCloud(
  uid: string,
  cellarId: string,
  readingIds: string[],
  bottleIds: string[],
): Promise<void> {
  const firestore = requireDb();
  const refs = [
    doc(firestore, 'users', uid, 'cellars', cellarId),
    ...readingIds.map((id) => doc(firestore, 'users', uid, 'readings', id)),
    ...bottleIds.map((id) => doc(firestore, 'users', uid, 'bottles', id)),
  ];

  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(firestore);
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

export async function saveReadingToCloud(uid: string, reading: CellarReading): Promise<void> {
  const firestore = requireDb();
  await setDoc(doc(firestore, 'users', uid, 'readings', reading.id), stripUndefined(reading));
}

export async function deleteReadingFromCloud(uid: string, readingId: string): Promise<void> {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'users', uid, 'readings', readingId));
}

export async function saveBottleToCloud(uid: string, bottle: Bottle): Promise<void> {
  const firestore = requireDb();
  await setDoc(doc(firestore, 'users', uid, 'bottles', bottle.id), stripUndefined(bottle));
}

export async function updateBottleFieldsInCloud(
  uid: string,
  bottleId: string,
  fields: Partial<Bottle>,
): Promise<void> {
  const firestore = requireDb();
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    payload[key] = value === undefined ? deleteField() : value;
  }
  await updateDoc(doc(firestore, 'users', uid, 'bottles', bottleId), payload);
}

export async function deleteBottleFromCloud(uid: string, bottleId: string): Promise<void> {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'users', uid, 'bottles', bottleId));
}

export async function saveTastingToCloud(uid: string, tasting: TastingEntry): Promise<void> {
  const firestore = requireDb();
  await setDoc(doc(firestore, 'users', uid, 'tastings', tasting.id), stripUndefined(tasting));
}

export async function deleteTastingFromCloud(uid: string, tastingId: string): Promise<void> {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'users', uid, 'tastings', tastingId));
}

export async function replaceAllUserDataInCloud(
  uid: string,
  currentData: AppStateData,
  nextData: AppStateData,
): Promise<void> {
  const firestore = requireDb();

  type BatchOp =
    | { type: 'delete'; ref: ReturnType<typeof doc> }
    | { type: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown> };

  const ops: BatchOp[] = [
    ...currentData.cellars.map((c) => ({
      type: 'delete' as const,
      ref: doc(firestore, 'users', uid, 'cellars', c.id),
    })),
    ...currentData.readings.map((r) => ({
      type: 'delete' as const,
      ref: doc(firestore, 'users', uid, 'readings', r.id),
    })),
    ...currentData.bottles.map((b) => ({
      type: 'delete' as const,
      ref: doc(firestore, 'users', uid, 'bottles', b.id),
    })),
    ...currentData.tastings.map((t) => ({
      type: 'delete' as const,
      ref: doc(firestore, 'users', uid, 'tastings', t.id),
    })),
    ...nextData.cellars.map((c) => ({
      type: 'set' as const,
      ref: doc(firestore, 'users', uid, 'cellars', c.id),
      data: stripUndefined(c) as Record<string, unknown>,
    })),
    ...nextData.readings.map((r) => ({
      type: 'set' as const,
      ref: doc(firestore, 'users', uid, 'readings', r.id),
      data: stripUndefined(r) as Record<string, unknown>,
    })),
    ...nextData.bottles.map((b) => ({
      type: 'set' as const,
      ref: doc(firestore, 'users', uid, 'bottles', b.id),
      data: stripUndefined(b) as Record<string, unknown>,
    })),
    ...nextData.tastings.map((t) => ({
      type: 'set' as const,
      ref: doc(firestore, 'users', uid, 'tastings', t.id),
      data: stripUndefined(t) as Record<string, unknown>,
    })),
  ];

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(firestore);
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
