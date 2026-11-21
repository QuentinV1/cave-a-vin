import React, { useMemo, useState } from 'react';
import { Edit3, Grid3X3, MapPin, Minus, Plus, Wine } from 'lucide-react';
import { Bottle, Cellar } from '../types/wine';
import { computeTastingStatus, WINE_COLOR_BADGES } from '../utils/wineUtils';

interface RackPlanViewProps {
  cellars: Cellar[];
  bottles: Bottle[];
  onAssignRack: (bottleId: string, rackLocation: string) => void;
  onConsumeOne: (bottleId: string) => void;
  onEditBottle: (bottle: Bottle) => void;
}

function normalizeSlotCode(rackLocation?: string): string | null {
  if (!rackLocation) return null;
  const match = rackLocation.toUpperCase().match(/\b([A-L])\s*[-:]?\s*(\d{1,2})\b/);
  if (!match) return null;
  return `${match[1]}${Number(match[2])}`;
}

export const RackPlanView: React.FC<RackPlanViewProps> = ({
  cellars,
  bottles,
  onAssignRack,
  onConsumeOne,
  onEditBottle,
}) => {
  const [selectedCellarId, setSelectedCellarId] = useState<string>(cellars[0]?.id ?? '');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [assignBottleId, setAssignBottleId] = useState<string>('');

  const activeCellar =
    cellars.find((c) => c.id === selectedCellarId) ?? cellars[0] ?? null;

  const rows = Math.min(12, Math.max(1, activeCellar?.rackRows ?? 5));
  const cols = Math.min(12, Math.max(1, activeCellar?.rackCols ?? 6));

  const cellarBottles = useMemo(
    () =>
      activeCellar
        ? bottles.filter((b) => b.cellarId === activeCellar.id && b.quantity > 0)
        : [],
    [activeCellar, bottles],
  );

  const { slotMap, unassigned } = useMemo(() => {
    const map = new Map<string, Bottle[]>();
    const unplaced: Bottle[] = [];
    const validCodes = new Set<string>();

    for (let r = 0; r < rows; r++) {
      const rowLetter = String.fromCharCode(65 + r);
      for (let c = 1; c <= cols; c++) {
        validCodes.add(`${rowLetter}${c}`);
      }
    }

    for (const b of cellarBottles) {
      const code = normalizeSlotCode(b.rackLocation);
      if (code && validCodes.has(code)) {
        const list = map.get(code) ?? [];
        list.push(b);
        map.set(code, list);
      } else {
        unplaced.push(b);
      }
    }
    return { slotMap: map, unassigned: unplaced };
  }, [cellarBottles, rows, cols]);

  if (!activeCellar) {
    return (
      <div className="rounded-2xl border border-dashed border-cellar-700 bg-cellar-900/50 p-10 text-center text-stone-400">
        Créez d'abord une cave pour afficher son plan visuel.
      </div>
    );
  }

  const selectedSlotBottles = selectedSlot ? slotMap.get(selectedSlot) ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-stone-100">
            Plan visuel des casiers
          </h2>
          <p className="text-sm text-stone-400">
            Cliquez sur un casier (ex. A1, B3) pour inspecter son contenu ou y placer une bouteille.
          </p>
        </div>

        <select
          value={activeCellar.id}
          onChange={(e) => {
            setSelectedCellarId(e.target.value);
            setSelectedSlot(null);
          }}
          className="w-full rounded-xl border border-cellar-700 bg-cellar-900 px-3.5 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none sm:w-auto"
        >
          {cellars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.rackRows ?? 5}×{c.rackCols ?? 6})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Rack Grid */}
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-cellar-700/80 bg-cellar-900/90 p-3.5 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
            <span className="inline-flex items-center gap-1.5 font-medium text-stone-200">
              <Grid3X3 className="h-4 w-4 text-gold-400" />
              {activeCellar.name} — {rows} rangées × {cols} colonnes
            </span>
            <span>
              {slotMap.size} / {rows * cols} casiers occupés
            </span>
          </div>

          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(72px, 1fr))`,
            }}
          >
            {Array.from({ length: rows }).map((_, rIdx) => {
              const rowLetter = String.fromCharCode(65 + rIdx);
              return Array.from({ length: cols }).map((__, cIdx) => {
                const code = `${rowLetter}${cIdx + 1}`;
                const slotBottles = slotMap.get(code) ?? [];
                const totalQty = slotBottles.reduce((s, b) => s + b.quantity, 0);
                const first = slotBottles[0];
                const isSelected = selectedSlot === code;
                const colorStyle = first ? WINE_COLOR_BADGES[first.color] : null;
                const hasUrgent = slotBottles.some(
                  (b) => computeTastingStatus(b).status === 'urgent',
                );

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(code);
                      setAssignBottleId(unassigned[0]?.id ?? '');
                    }}
                    className={`relative flex min-h-[74px] flex-col justify-between rounded-xl border p-2 text-left transition ${
                      isSelected
                        ? 'border-gold-400 bg-bordeaux-900/60 ring-2 ring-gold-400/40'
                        : first
                          ? 'border-cellar-600 bg-cellar-950/90 hover:border-bordeaux-500'
                          : 'border-dashed border-cellar-800 bg-cellar-950/40 hover:border-cellar-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-stone-400">{code}</span>
                      {colorStyle && (
                        <span className={`h-2.5 w-2.5 rounded-full ${colorStyle.dot}`} />
                      )}
                    </div>

                    {first ? (
                      <div className="mt-1 space-y-0.5">
                        <p className="line-clamp-1 text-[11px] font-medium text-stone-100">
                          {first.name}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-stone-400">
                          <span>{first.vintage ?? 'NM'}</span>
                          <span className="font-semibold text-gold-400">{totalQty} btl</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-stone-600">Vide</span>
                    )}

                    {hasUrgent && (
                      <span
                        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-500"
                        title="Bouteille urgente à boire"
                      />
                    )}
                  </button>
                );
              });
            })}
          </div>
        </div>

        {/* Side Panel: Slot details & Unassigned */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-cellar-700/80 bg-cellar-900/90 p-4">
            <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-stone-100">
              <MapPin className="h-4 w-4 text-gold-400" />
              {selectedSlot ? `Casier ${selectedSlot}` : 'Sélectionnez un casier'}
            </h3>

            {!selectedSlot ? (
              <p className="mt-2 text-xs text-stone-400">
                Cliquez sur une case du plan pour voir les bouteilles rangées à cet endroit ou y assigner une référence.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {selectedSlotBottles.length === 0 ? (
                  <p className="text-xs text-stone-400">Ce casier est actuellement vide.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedSlotBottles.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl border border-cellar-700/80 bg-cellar-950/80 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-stone-100">
                              {b.name}
                            </p>
                            <p className="text-xs text-stone-400">
                              {b.appellation} {b.vintage ? `• ${b.vintage}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-gold-400">
                            {b.quantity} btl
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onConsumeOne(b.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-bordeaux-700/70 bg-bordeaux-800/50 px-2.5 py-1 text-xs text-rose-100 hover:bg-bordeaux-600"
                          >
                            <Minus className="h-3 w-3" />
                            Boire 1
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditBottle(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-cellar-700 px-2.5 py-1 text-xs text-stone-300 hover:bg-cellar-800"
                          >
                            <Edit3 className="h-3 w-3" />
                            Modifier
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {unassigned.length > 0 && (
                  <div className="border-t border-cellar-800 pt-3">
                    <label className="mb-1.5 block text-xs font-medium text-stone-300">
                      Placer une bouteille non rangée ici :
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={assignBottleId}
                        onChange={(e) => setAssignBottleId(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-cellar-700 bg-cellar-950 px-2.5 py-2 text-xs text-stone-100 sm:py-1.5"
                      >
                        {unassigned.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} {b.vintage ? `(${b.vintage})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!assignBottleId}
                        onClick={() => {
                          if (assignBottleId && selectedSlot) {
                            onAssignRack(assignBottleId, `Casier ${selectedSlot}`);
                          }
                        }}
                        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-bordeaux-600 px-3 py-2 text-xs font-medium text-white hover:bg-bordeaux-500 disabled:opacity-50 sm:py-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Placer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {unassigned.length > 0 && (
            <div className="rounded-2xl border border-cellar-700/80 bg-cellar-900/70 p-4">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-300">
                <Wine className="h-3.5 w-3.5 text-bordeaux-500" />
                Sans casier attribué ({unassigned.length})
              </h4>
              <ul className="mt-2 space-y-1.5 text-xs text-stone-400">
                {unassigned.slice(0, 6).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{b.name}</span>
                    <span className="shrink-0 text-stone-500">{b.quantity} btl</span>
                  </li>
                ))}
                {unassigned.length > 6 && (
                  <li className="text-[11px] italic text-stone-500">
                    + {unassigned.length - 6} autre(s)...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
