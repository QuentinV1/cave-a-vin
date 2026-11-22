import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowUpDown,
  Cloud,
  Database,
  Flame,
  Grid3X3,
  Plus,
  Search,
  Sparkles,
  User as UserIcon,
  Warehouse,
  Wine,
} from 'lucide-react';
import {
  Bottle,
  Cellar,
  CellarBackupData,
  CellarReading,
  TastingEntry,
  TastingStatus,
  WineColor,
} from './types/wine';
import { AppStateData, loadAppData, saveAppData } from './utils/storage';
import { db, deconnexionFirebase, observerAuth } from './utils/firebase';
import { clearHubAuthCache, verifyUserAccess } from './utils/accessControl';
import {
  activerSyncCloud,
  arreterListenersFirestore,
  cloudState as initialCloudState,
  CloudState,
  forcerSyncCloud,
  planifierPushCloud,
  reinitialiserEtatCloud,
  subscribeCloudState,
} from './utils/firestoreStorage';
import {
  computeTastingStatus,
  evaluateReading,
  formatCurrency,
  generateId,
  WINE_COLOR_LABELS,
} from './utils/wineUtils';
import { CloudAuthModal } from './components/AuthScreen';
import { AccessGate, AccessGateState } from './components/AccessGate';
import { BottleCard } from './components/BottleCard';
import { BottleModal } from './components/BottleModal';
import { CellarModal } from './components/CellarModal';
import { ReadingModal } from './components/ReadingModal';
import { CellarsView } from './components/CellarsView';
import { TastingView } from './components/TastingView';
import { BackupView } from './components/BackupView';
import { RackPlanView } from './components/RackPlanView';
import { TastingNoteModal } from './components/TastingNoteModal';

type TabKey = 'inventory' | 'plan' | 'cellars' | 'tasting' | 'backup';
type SortKey = 'name' | 'vintage_desc' | 'vintage_asc' | 'price_desc' | 'quantity_desc';

const CURRENT_APP_VERSION = '1.1.0';

const EMPTY_DATA: AppStateData = {
  cellars: [],
  readings: [],
  bottles: [],
  tastings: [],
};

export const App: React.FC = () => {
  const [data, setData] = useState<AppStateData>(() => loadAppData());
  const dataRef = useRef<AppStateData>(data);
  dataRef.current = data;

  const [user, setUser] = useState<User | null>(null);
  const [gate, setGate] = useState<AccessGateState>({ phase: 'loading' });
  const userRef = useRef<User | null>(null);
  const [cloudStateSnap, setCloudStateSnap] = useState<CloudState>({
    ...initialCloudState,
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('inventory');

  // Inventory filters & sort
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCellarId, setSelectedCellarId] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<WineColor | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<TastingStatus | 'all'>('all');
  const [hideEmpty, setHideEmpty] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('name');

  // Modals
  const [bottleModalOpen, setBottleModalOpen] = useState(false);
  const [editingBottle, setEditingBottle] = useState<Bottle | null>(null);

  const [cellarModalOpen, setCellarModalOpen] = useState(false);
  const [editingCellar, setEditingCellar] = useState<Cellar | null>(null);

  const [readingModalCellar, setReadingModalCellar] = useState<Cellar | null>(null);
  const [tastingModalBottle, setTastingModalBottle] = useState<Bottle | null>(null);

  const applyLocalDataFromCloud = useCallback((nextData: AppStateData) => {
    dataRef.current = nextData;
    setData(nextData);
  }, []);

  const sauvegarderDonnees = useCallback(
    (nextData: AppStateData, skipCloud = false) => {
      dataRef.current = nextData;
      setData(nextData);
      const saveResult = saveAppData(nextData);
      if (!saveResult.ok) {
        setStorageError(
          saveResult.error ?? 'Impossible de sauvegarder les données localement.',
        );
      } else {
        setStorageError(null);
      }
      if (!skipCloud) {
        planifierPushCloud(() => dataRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    return subscribeCloudState(setCloudStateSnap);
  }, []);

  const runAccessCheck = useCallback(
    async (targetUser: User, background = false) => {
      if (!background) {
        setGate({ phase: 'loading' });
      }
      const res = await verifyUserAccess(db, 'cave-a-vin', targetUser);
      if (userRef.current?.uid !== targetUser.uid) return;
      if (res.outcome === 'authorized') {
        setGate({ phase: 'authorized', status: res.status, offline: res.offline });
        activerSyncCloud(() => dataRef.current, applyLocalDataFromCloud);
      } else if (res.outcome === 'unauthorized') {
        arreterListenersFirestore();
        reinitialiserEtatCloud();
        setGate({ phase: 'unauthorized', email: res.email });
      } else {
        arreterListenersFirestore();
        reinitialiserEtatCloud();
        setGate({ phase: 'offline_unverified', email: res.email });
      }
    },
    [applyLocalDataFromCloud],
  );

  useEffect(() => {
    const onOnline = () => {
      if (userRef.current) {
        void runAccessCheck(userRef.current, true);
      }
    };
    window.addEventListener('online', onOnline);

    const unsubscribe = observerAuth((firebaseUser) => {
      userRef.current = firebaseUser;
      setUser(firebaseUser);
      if (firebaseUser) {
        void runAccessCheck(firebaseUser, false);
      } else {
        arreterListenersFirestore();
        reinitialiserEtatCloud();
        setGate({ phase: 'unauthenticated' });
      }
    });
    return () => {
      window.removeEventListener('online', onOnline);
      unsubscribe();
      arreterListenersFirestore();
    };
  }, [runAccessCheck]);

  const handleRestartSync = useCallback(() => {
    activerSyncCloud(() => dataRef.current, applyLocalDataFromCloud);
  }, [applyLocalDataFromCloud]);

  const handleForceSync = useCallback(async () => {
    await forcerSyncCloud(dataRef.current);
  }, []);

  const handleGateSignOut = useCallback(async () => {
    clearHubAuthCache('cave-a-vin');
    arreterListenersFirestore();
    await deconnexionFirebase();
    reinitialiserEtatCloud();
    userRef.current = null;
    setUser(null);
    setGate({ phase: 'unauthenticated' });
  }, []);

  const handleSignOutCloud = useCallback(async () => {
    if (!window.confirm('Se déconnecter du compte Cloud ?')) return;
    clearHubAuthCache('cave-a-vin');
    arreterListenersFirestore();
    await deconnexionFirebase();
    reinitialiserEtatCloud();
    setAuthModalOpen(false);
  }, []);

  // Global KPIs
  const stats = useMemo(() => {
    const totalBottles = data.bottles.reduce((sum, b) => sum + b.quantity, 0);
    const totalValue = data.bottles.reduce(
      (sum, b) => sum + (b.estimatedCurrentPrice ?? b.purchasePrice ?? 0) * b.quantity,
      0,
    );
    const urgentBottles = data.bottles
      .filter((b) => b.quantity > 0 && computeTastingStatus(b).status === 'urgent')
      .reduce((sum, b) => sum + b.quantity, 0);

    let climateAlerts = 0;
    for (const cellar of data.cellars) {
      const latest = data.readings
        .filter((r) => r.cellarId === cellar.id)
        .sort(
          (a, b) =>
            new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
        )[0];
      if (latest && evaluateReading(latest, cellar).hasAlert) {
        climateAlerts += 1;
      }
    }

    return { totalBottles, totalValue, urgentBottles, climateAlerts };
  }, [data]);

  const cellarMap = useMemo(
    () => new Map(data.cellars.map((c) => [c.id, c])),
    [data.cellars],
  );

  // Filtered & sorted bottles
  const filteredBottles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return data.bottles
      .filter((b) => {
        if (hideEmpty && b.quantity <= 0) return false;
        if (selectedCellarId !== 'all' && b.cellarId !== selectedCellarId) return false;
        if (selectedColor !== 'all' && b.color !== selectedColor) return false;
        if (selectedStatus !== 'all' && computeTastingStatus(b).status !== selectedStatus) {
          return false;
        }
        if (q) {
          const hay = [
            b.name,
            b.appellation,
            b.vintage ? String(b.vintage) : '',
            b.rackLocation ?? '',
            b.barcode ?? '',
            b.notes ?? '',
            ...(b.foodPairings ?? []),
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'vintage_desc':
            return (b.vintage ?? 0) - (a.vintage ?? 0);
          case 'vintage_asc':
            return (a.vintage ?? 9999) - (b.vintage ?? 9999);
          case 'price_desc':
            return (
              (b.estimatedCurrentPrice ?? b.purchasePrice ?? 0) -
              (a.estimatedCurrentPrice ?? a.purchasePrice ?? 0)
            );
          case 'quantity_desc':
            return b.quantity - a.quantity;
          case 'name':
          default:
            return a.name.localeCompare(b.name, 'fr');
        }
      });
  }, [
    data.bottles,
    hideEmpty,
    selectedCellarId,
    selectedColor,
    selectedStatus,
    searchQuery,
    sortBy,
  ]);

  const filteredSummary = useMemo(() => {
    const count = filteredBottles.reduce((s, b) => s + b.quantity, 0);
    const value = filteredBottles.reduce(
      (s, b) => s + (b.estimatedCurrentPrice ?? b.purchasePrice ?? 0) * b.quantity,
      0,
    );
    return { count, value };
  }, [filteredBottles]);

  // Bottle CRUD (Local-first + debounced cloud push)
  const handleSaveBottle = (
    payload: Omit<Bottle, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
  ) => {
    const current = dataRef.current;
    const now = new Date().toISOString();
    const existing = existingId
      ? current.bottles.find((b) => b.id === existingId)
      : undefined;
    const bottle: Bottle = existing
      ? { ...existing, ...payload, updatedAt: now }
      : {
          ...payload,
          id: generateId('bot'),
          createdAt: now,
          updatedAt: now,
        };

    const nextBottles = existing
      ? current.bottles.map((b) => (b.id === bottle.id ? bottle : b))
      : [bottle, ...current.bottles];

    sauvegarderDonnees({ ...current, bottles: nextBottles });
  };

  const handleAdjustQuantity = (bottleId: string, delta: number) => {
    const current = dataRef.current;
    const bottle = current.bottles.find((b) => b.id === bottleId);
    if (!bottle) return;
    const now = new Date().toISOString();
    const quantity = Math.max(0, bottle.quantity + delta);
    const nextBottles = current.bottles.map((b) =>
      b.id === bottleId ? { ...b, quantity, updatedAt: now } : b,
    );
    sauvegarderDonnees({ ...current, bottles: nextBottles });
  };

  const handleDeleteBottle = (bottleId: string) => {
    const current = dataRef.current;
    const bottle = current.bottles.find((b) => b.id === bottleId);
    if (!bottle) return;
    if (!window.confirm(`Supprimer « ${bottle.name} » de votre cave ?`)) return;
    const nextBottles = current.bottles.filter((b) => b.id !== bottleId);
    sauvegarderDonnees({ ...current, bottles: nextBottles });
  };

  // Cellar CRUD (Local-first + debounced cloud push)
  const handleSaveCellar = (
    payload: Omit<Cellar, 'id' | 'createdAt'>,
    existingId?: string,
  ) => {
    const current = dataRef.current;
    const existing = existingId
      ? current.cellars.find((c) => c.id === existingId)
      : undefined;
    const cellar: Cellar = existing
      ? { ...existing, ...payload }
      : {
          ...payload,
          id: generateId('cellar'),
          createdAt: new Date().toISOString(),
        };
    const nextCellars = existing
      ? current.cellars.map((c) => (c.id === cellar.id ? cellar : c))
      : [...current.cellars, cellar];

    sauvegarderDonnees({ ...current, cellars: nextCellars });
  };

  const handleDeleteCellar = (cellarId: string) => {
    const current = dataRef.current;
    const cellar = current.cellars.find((c) => c.id === cellarId);
    if (!cellar) return;
    const linkedBottles = current.bottles.filter((b) => b.cellarId === cellarId);
    const msg =
      linkedBottles.length > 0
        ? `Supprimer « ${cellar.name} » ainsi que ses ${linkedBottles.length} référence(s) et ses relevés ?`
        : `Supprimer la cave « ${cellar.name} » et ses relevés ?`;
    if (!window.confirm(msg)) return;

    sauvegarderDonnees({
      ...current,
      cellars: current.cellars.filter((c) => c.id !== cellarId),
      bottles: current.bottles.filter((b) => b.cellarId !== cellarId),
      readings: current.readings.filter((r) => r.cellarId !== cellarId),
    });
    if (selectedCellarId === cellarId) {
      setSelectedCellarId('all');
    }
  };

  // Readings CRUD (Local-first + debounced cloud push)
  const handleSaveReading = (payload: {
    cellarId: string;
    temperature: number;
    humidity: number;
    recordedAt: string;
    note?: string;
  }) => {
    const current = dataRef.current;
    const newReading: CellarReading = {
      ...payload,
      id: generateId('read'),
    };
    sauvegarderDonnees({
      ...current,
      readings: [newReading, ...current.readings],
    });
  };

  const handleDeleteReading = (readingId: string) => {
    const current = dataRef.current;
    sauvegarderDonnees({
      ...current,
      readings: current.readings.filter((r) => r.id !== readingId),
    });
  };

  // Tastings & Rack CRUD (Local-first + debounced cloud push)
  const handleSaveTasting = (entry: Omit<TastingEntry, 'id'>) => {
    const current = dataRef.current;
    const newEntry: TastingEntry = {
      ...entry,
      id: generateId('taste'),
    };
    sauvegarderDonnees({
      ...current,
      tastings: [newEntry, ...current.tastings],
    });
  };

  const handleDeleteTasting = (tastingId: string) => {
    const current = dataRef.current;
    sauvegarderDonnees({
      ...current,
      tastings: current.tastings.filter((t) => t.id !== tastingId),
    });
  };

  const handleAssignRack = (bottleId: string, rackLocation: string) => {
    const current = dataRef.current;
    const now = new Date().toISOString();
    const nextBottles = current.bottles.map((b) =>
      b.id === bottleId
        ? { ...b, rackLocation: rackLocation || undefined, updatedAt: now }
        : b,
    );
    sauvegarderDonnees({ ...current, bottles: nextBottles });
  };

  // Backup handlers (Local-first + debounced cloud push)
  const handleImportReplace = (backup: CellarBackupData) => {
    const nextData: AppStateData = {
      cellars: backup.cellars,
      readings: backup.readings,
      bottles: backup.bottles,
      tastings: backup.tastings ?? [],
    };
    sauvegarderDonnees(nextData);
  };

  const handleClearAll = () => {
    sauvegarderDonnees(EMPTY_DATA);
  };

  const openAddBottle = () => {
    if (data.cellars.length === 0) {
      alert('Créez d’abord une cave dans l’onglet « Mes Caves ».');
      setActiveTab('cellars');
      setEditingCellar(null);
      setCellarModalOpen(true);
      return;
    }
    setEditingBottle(null);
    setBottleModalOpen(true);
  };

  const authLabel = user
    ? (user.email || user.displayName || 'Cloud').split('@')[0]
    : 'Connexion';

  const itemSummaryLabel = `${data.bottles.length} référence${
    data.bottles.length > 1 ? 's' : ''
  }, ${data.cellars.length} cave${data.cellars.length > 1 ? 's' : ''}`;

  if (gate.phase !== 'authorized') {
    return (
      <AccessGate
        gate={gate}
        user={user}
        onRetryVerification={() => {
          if (userRef.current) {
            void runAccessCheck(userRef.current, false);
          }
        }}
        onSignOut={handleGateSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#2a1019_0%,_#11070a_45%,_#0b0507_100%)] text-stone-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-cellar-800/90 bg-cellar-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold-500/30 bg-gradient-to-br from-bordeaux-600 to-bordeaux-800 shadow-lg shadow-bordeaux-900/50 sm:h-10 sm:w-10">
              <Wine className="h-4 w-4 text-gold-400 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-serif text-lg font-bold tracking-tight text-stone-100 sm:text-2xl">
                  La Cave
                </h1>
                <span
                  id="header-version-badge"
                  className="shrink-0 rounded-md border border-cellar-700 bg-cellar-900 px-1.5 py-0.5 text-[10px] font-semibold text-stone-400"
                >
                  v{CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="truncate text-[11px] text-stone-400">
                Gestion de stock, dégustation & climat
              </p>
            </div>
          </div>

          {/* Global KPIs */}
          <div className="hidden items-center gap-5 lg:flex">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-stone-500">
                Stock total
              </div>
              <div className="text-sm font-bold text-stone-100">
                {stats.totalBottles} bouteille{stats.totalBottles > 1 ? 's' : ''}
              </div>
            </div>
            <div className="h-7 w-px bg-cellar-800" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-stone-500">
                Valeur cave
              </div>
              <div className="text-sm font-bold text-gold-400">
                {formatCurrency(stats.totalValue)}
              </div>
            </div>
            {stats.urgentBottles > 0 && (
              <>
                <div className="h-7 w-px bg-cellar-800" />
                <button
                  type="button"
                  onClick={() => setActiveTab('tasting')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-orange-700/60 bg-orange-950/50 px-3 py-1 text-xs font-medium text-orange-200 transition hover:bg-orange-900/60"
                >
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  {stats.urgentBottles} urgente{stats.urgentBottles > 1 ? 's' : ''}
                </button>
              </>
            )}
            {stats.climateAlerts > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('cellars')}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/60 bg-amber-950/50 px-3 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-900/60"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                {stats.climateAlerts} alerte{stats.climateAlerts > 1 ? 's' : ''} T°/Hygro
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              id="btn-auth-header"
              onClick={() => setAuthModalOpen(true)}
              title={
                user
                  ? `Connecté : ${user.email || user.uid}`
                  : 'Se connecter au Cloud'
              }
              aria-label="Compte Cloud"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition sm:gap-2 sm:px-3 sm:py-2.5 ${
                user
                  ? 'is-authenticated border-gold-500/40 bg-cellar-900/90 text-stone-100 hover:border-gold-400'
                  : 'border-cellar-700 bg-cellar-900/80 text-stone-300 hover:border-bordeaux-500 hover:text-white'
              }`}
            >
              {user ? (
                <UserIcon className="h-4 w-4 text-gold-400" />
              ) : (
                <Cloud className="h-4 w-4 text-stone-300" />
              )}
              <span className="btn-text max-w-[90px] truncate sm:max-w-[120px]">{authLabel}</span>
              {user && (
                <span
                  className={`h-2 w-2 rounded-full ${
                    cloudStateSnap.syncStatus === 'error'
                      ? 'bg-red-400'
                      : !user.emailVerified ||
                          cloudStateSnap.syncStatus === 'syncing'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={openAddBottle}
              className="inline-flex items-center gap-1.5 rounded-xl bg-bordeaux-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-bordeaux-900/50 transition hover:bg-bordeaux-500 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Ajouter une bouteille</span>
              <span className="sm:hidden">Ajouter</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto overscroll-x-contain px-3 sm:px-6">
          {(
            [
              { key: 'inventory', label: 'Inventaire', icon: Wine },
              { key: 'plan', label: 'Plan des casiers', icon: Grid3X3 },
              { key: 'cellars', label: 'Mes Caves', icon: Warehouse },
              { key: 'tasting', label: 'Dégustation', icon: Sparkles },
              { key: 'backup', label: 'Sauvegarde', icon: Database },
            ] as const
          ).map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition sm:gap-2 sm:px-4 sm:text-sm ${
                  active
                    ? 'border-gold-400 text-gold-400'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {key === 'cellars' && stats.climateAlerts > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    {stats.climateAlerts}
                  </span>
                )}
                {key === 'tasting' && stats.urgentBottles > 0 && (
                  <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-300">
                    {stats.urgentBottles}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Storage error */}
      {storageError && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-red-700/60 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{storageError}</span>
          </div>
        </div>
      )}

      {/* Mobile KPI strip */}
      <div className="mx-auto mt-4 grid max-w-7xl grid-cols-2 gap-3 px-4 sm:px-6 lg:hidden">
        <div className="rounded-xl border border-cellar-800 bg-cellar-900/70 px-3.5 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-stone-500">
            Stock total
          </div>
          <div className="text-base font-bold text-stone-100">
            {stats.totalBottles} btl
          </div>
        </div>
        <div className="rounded-xl border border-cellar-800 bg-cellar-900/70 px-3.5 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-stone-500">
            Valeur totale
          </div>
          <div className="text-base font-bold text-gold-400">
            {formatCurrency(stats.totalValue)}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'inventory' && (
          <div className="space-y-5">
            {/* Search & Filters */}
            <div className="rounded-2xl border border-cellar-800/90 bg-cellar-900/75 p-4 shadow-lg">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="relative md:col-span-4">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <input
                    type="text"
                    maxLength={100}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher vin, domaine, millésime, code-barres..."
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-950 py-2.5 pl-10 pr-3.5 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <select
                    value={selectedCellarId}
                    onChange={(e) => setSelectedCellarId(e.target.value)}
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3 py-2.5 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                  >
                    <option value="all">Toutes les caves</option>
                    {data.cellars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <select
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value as WineColor | 'all')}
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3 py-2.5 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                  >
                    <option value="all">Toutes couleurs</option>
                    {(Object.keys(WINE_COLOR_LABELS) as WineColor[]).map((k) => (
                      <option key={k} value={k}>
                        {WINE_COLOR_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <select
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(e.target.value as TastingStatus | 'all')
                    }
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3 py-2.5 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                  >
                    <option value="all">Tous statuts</option>
                    <option value="urgent">Urgent / Fin de garde</option>
                    <option value="apogee">À boire / Apogée</option>
                    <option value="a_garder">À garder</option>
                    <option value="inconnu">Non défini</option>
                  </select>
                </div>

                <div className="relative md:col-span-2">
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-950 py-2.5 pl-9 pr-3 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                  >
                    <option value="name">Nom (A-Z)</option>
                    <option value="vintage_desc">Millésime (récent)</option>
                    <option value="vintage_asc">Millésime (ancien)</option>
                    <option value="price_desc">Prix décroissant</option>
                    <option value="quantity_desc">Quantité</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cellar-800/70 pt-3 text-xs text-stone-400">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hideEmpty}
                    onChange={(e) => setHideEmpty(e.target.checked)}
                    className="h-4 w-4 rounded border-cellar-700 bg-cellar-950 text-bordeaux-600 focus:ring-bordeaux-500"
                  />
                  Masquer les références à 0 bouteille
                </label>

                <div>
                  <span className="font-medium text-stone-200">
                    {filteredBottles.length} référence(s)
                  </span>{' '}
                  • {filteredSummary.count} bouteille(s) •{' '}
                  <span className="font-semibold text-gold-400">
                    {formatCurrency(filteredSummary.value)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottle Grid */}
            {filteredBottles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-cellar-700 bg-cellar-900/40 p-12 text-center">
                <Wine className="mx-auto mb-3 h-10 w-10 text-stone-500" />
                <p className="font-serif text-lg text-stone-300">
                  Aucune bouteille trouvée
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Modifiez vos filtres ou ajoutez une nouvelle bouteille à votre cave.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredBottles.map((bottle) => (
                  <BottleCard
                    key={bottle.id}
                    bottle={bottle}
                    cellar={cellarMap.get(bottle.cellarId)}
                    onConsumeOne={(id) => handleAdjustQuantity(id, -1)}
                    onAddOne={(id) => handleAdjustQuantity(id, 1)}
                    onLogTasting={(b) => setTastingModalBottle(b)}
                    onEdit={(b) => {
                      setEditingBottle(b);
                      setBottleModalOpen(true);
                    }}
                    onDelete={handleDeleteBottle}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'plan' && (
          <RackPlanView
            cellars={data.cellars}
            bottles={data.bottles}
            onAssignRack={handleAssignRack}
            onConsumeOne={(id) => handleAdjustQuantity(id, -1)}
            onEditBottle={(b) => {
              setEditingBottle(b);
              setBottleModalOpen(true);
            }}
          />
        )}

        {activeTab === 'cellars' && (
          <CellarsView
            cellars={data.cellars}
            readings={data.readings}
            bottles={data.bottles}
            onAddCellar={() => {
              setEditingCellar(null);
              setCellarModalOpen(true);
            }}
            onEditCellar={(c) => {
              setEditingCellar(c);
              setCellarModalOpen(true);
            }}
            onDeleteCellar={handleDeleteCellar}
            onAddReading={(c) => setReadingModalCellar(c)}
            onDeleteReading={handleDeleteReading}
          />
        )}

        {activeTab === 'tasting' && (
          <TastingView
            bottles={data.bottles}
            cellars={data.cellars}
            tastings={data.tastings}
            onConsumeOne={(id) => handleAdjustQuantity(id, -1)}
            onAddOne={(id) => handleAdjustQuantity(id, 1)}
            onLogTasting={(b) => setTastingModalBottle(b)}
            onDeleteTasting={handleDeleteTasting}
            onEdit={(b) => {
              setEditingBottle(b);
              setBottleModalOpen(true);
            }}
            onDelete={handleDeleteBottle}
          />
        )}

        {activeTab === 'backup' && (
          <BackupView
            data={data}
            user={user}
            cloudState={cloudStateSnap}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onForceSync={handleForceSync}
            onImportReplace={handleImportReplace}
            onClearAll={handleClearAll}
          />
        )}
      </main>

      {/* Modals */}
      <CloudAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        cloudState={cloudStateSnap}
        itemSummaryLabel={itemSummaryLabel}
        onForceSync={handleForceSync}
        onRestartSync={handleRestartSync}
        onSignOut={handleSignOutCloud}
        onUserReloaded={setUser}
      />

      <BottleModal
        isOpen={bottleModalOpen}
        editingBottle={editingBottle}
        cellars={data.cellars}
        existingBottles={data.bottles}
        defaultCellarId={selectedCellarId !== 'all' ? selectedCellarId : undefined}
        onClose={() => {
          setBottleModalOpen(false);
          setEditingBottle(null);
        }}
        onSave={handleSaveBottle}
      />

      <CellarModal
        isOpen={cellarModalOpen}
        editingCellar={editingCellar}
        onClose={() => {
          setCellarModalOpen(false);
          setEditingCellar(null);
        }}
        onSave={handleSaveCellar}
      />

      <ReadingModal
        isOpen={readingModalCellar !== null}
        cellar={readingModalCellar}
        onClose={() => setReadingModalCellar(null)}
        onSave={handleSaveReading}
      />

      <TastingNoteModal
        isOpen={tastingModalBottle !== null}
        bottle={tastingModalBottle}
        onClose={() => setTastingModalBottle(null)}
        onSave={handleSaveTasting}
      />
    </div>
  );
};

export default App;
