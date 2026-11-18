import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Database,
  Flame,
  Grid3X3,
  Plus,
  Search,
  Sparkles,
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
import {
  AppStateData,
  createSeedData,
  loadAppData,
  saveAppData,
} from './utils/storage';
import {
  computeTastingStatus,
  evaluateReading,
  formatCurrency,
  generateId,
  WINE_COLOR_LABELS,
} from './utils/wineUtils';
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

export const App: React.FC = () => {
  const [data, setData] = useState<AppStateData>(() => loadAppData());
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

  useEffect(() => {
    const res = saveAppData(data);
    setStorageError(res.ok ? null : res.error ?? 'Erreur de sauvegarde.');
  }, [data]);

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

  // Bottle CRUD
  const handleSaveBottle = (
    payload: Omit<Bottle, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
  ) => {
    const now = new Date().toISOString();
    setData((prev) => {
      if (existingId) {
        return {
          ...prev,
          bottles: prev.bottles.map((b) =>
            b.id === existingId ? { ...b, ...payload, updatedAt: now } : b,
          ),
        };
      }
      const newBottle: Bottle = {
        ...payload,
        id: generateId('bot'),
        createdAt: now,
        updatedAt: now,
      };
      return { ...prev, bottles: [newBottle, ...prev.bottles] };
    });
  };

  const handleAdjustQuantity = (bottleId: string, delta: number) => {
    const now = new Date().toISOString();
    setData((prev) => ({
      ...prev,
      bottles: prev.bottles.map((b) =>
        b.id === bottleId
          ? { ...b, quantity: Math.max(0, b.quantity + delta), updatedAt: now }
          : b,
      ),
    }));
  };

  const handleDeleteBottle = (bottleId: string) => {
    const bottle = data.bottles.find((b) => b.id === bottleId);
    if (!bottle) return;
    if (!window.confirm(`Supprimer « ${bottle.name} » de votre cave ?`)) return;
    setData((prev) => ({
      ...prev,
      bottles: prev.bottles.filter((b) => b.id !== bottleId),
    }));
  };

  // Cellar CRUD
  const handleSaveCellar = (
    payload: Omit<Cellar, 'id' | 'createdAt'>,
    existingId?: string,
  ) => {
    setData((prev) => {
      if (existingId) {
        return {
          ...prev,
          cellars: prev.cellars.map((c) =>
            c.id === existingId ? { ...c, ...payload } : c,
          ),
        };
      }
      const newCellar: Cellar = {
        ...payload,
        id: generateId('cellar'),
        createdAt: new Date().toISOString(),
      };
      return { ...prev, cellars: [...prev.cellars, newCellar] };
    });
  };

  const handleDeleteCellar = (cellarId: string) => {
    const cellar = data.cellars.find((c) => c.id === cellarId);
    if (!cellar) return;
    const linkedBottles = data.bottles.filter((b) => b.cellarId === cellarId).length;
    const msg =
      linkedBottles > 0
        ? `Supprimer « ${cellar.name} » ainsi que ses ${linkedBottles} référence(s) et ses relevés ?`
        : `Supprimer la cave « ${cellar.name} » et ses relevés ?`;
    if (!window.confirm(msg)) return;

    setData((prev) => ({
      ...prev,
      cellars: prev.cellars.filter((c) => c.id !== cellarId),
      readings: prev.readings.filter((r) => r.cellarId !== cellarId),
      bottles: prev.bottles.filter((b) => b.cellarId !== cellarId),
    }));
    if (selectedCellarId === cellarId) {
      setSelectedCellarId('all');
    }
  };

  // Readings CRUD
  const handleSaveReading = (payload: {
    cellarId: string;
    temperature: number;
    humidity: number;
    recordedAt: string;
    note?: string;
  }) => {
    const newReading: CellarReading = {
      ...payload,
      id: generateId('read'),
    };
    setData((prev) => ({
      ...prev,
      readings: [newReading, ...prev.readings],
    }));
  };

  const handleDeleteReading = (readingId: string) => {
    setData((prev) => ({
      ...prev,
      readings: prev.readings.filter((r) => r.id !== readingId),
    }));
  };

  // Tastings & Rack CRUD
  const handleSaveTasting = (entry: Omit<TastingEntry, 'id'>) => {
    const newEntry: TastingEntry = {
      ...entry,
      id: generateId('taste'),
    };
    setData((prev) => ({
      ...prev,
      tastings: [newEntry, ...prev.tastings],
    }));
  };

  const handleDeleteTasting = (tastingId: string) => {
    setData((prev) => ({
      ...prev,
      tastings: prev.tastings.filter((t) => t.id !== tastingId),
    }));
  };

  const handleAssignRack = (bottleId: string, rackLocation: string) => {
    const now = new Date().toISOString();
    setData((prev) => ({
      ...prev,
      bottles: prev.bottles.map((b) =>
        b.id === bottleId ? { ...b, rackLocation, updatedAt: now } : b,
      ),
    }));
  };

  // Backup handlers
  const handleImportReplace = (backup: CellarBackupData) => {
    setData({
      cellars: backup.cellars,
      readings: backup.readings,
      bottles: backup.bottles,
      tastings: backup.tastings ?? [],
    });
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

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#2a1019_0%,_#11070a_45%,_#0b0507_100%)] text-stone-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-cellar-800/90 bg-cellar-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/30 bg-gradient-to-br from-bordeaux-600 to-bordeaux-800 shadow-lg shadow-bordeaux-900/50">
              <Wine className="h-5 w-5 text-gold-400" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold tracking-tight text-stone-100 sm:text-2xl">
                La Cave
              </h1>
              <p className="text-[11px] text-stone-400">
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

          <button
            type="button"
            onClick={openAddBottle}
            className="inline-flex items-center gap-2 rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-bordeaux-900/50 transition hover:bg-bordeaux-500"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter une bouteille</span>
            <span className="sm:hidden">Ajouter</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
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
                className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
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
            onImportReplace={handleImportReplace}
            onResetDemo={() => setData(createSeedData())}
            onClearAll={() =>
              setData({ cellars: [], readings: [], bottles: [], tastings: [] })
            }
          />
        )}
      </main>

      {/* Modals */}
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
