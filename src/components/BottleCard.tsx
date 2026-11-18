import React from 'react';
import {
  Barcode,
  Edit3,
  MapPin,
  Minus,
  Plus,
  Star,
  Trash2,
  Utensils,
  Wine,
} from 'lucide-react';
import { Bottle, Cellar } from '../types/wine';
import {
  computeTastingStatus,
  formatCurrency,
  getEffectiveDrinkTo,
  WINE_COLOR_BADGES,
  WINE_COLOR_LABELS,
} from '../utils/wineUtils';

interface BottleCardProps {
  bottle: Bottle;
  cellar?: Cellar;
  onConsumeOne: (bottleId: string) => void;
  onAddOne: (bottleId: string) => void;
  onLogTasting?: (bottle: Bottle) => void;
  onEdit: (bottle: Bottle) => void;
  onDelete: (bottleId: string) => void;
}

export const BottleCard: React.FC<BottleCardProps> = ({
  bottle,
  cellar,
  onConsumeOne,
  onAddOne,
  onLogTasting,
  onEdit,
  onDelete,
}) => {
  const colorStyle = WINE_COLOR_BADGES[bottle.color];
  const tasting = computeTastingStatus(bottle);
  const effectiveDrinkTo = getEffectiveDrinkTo(bottle);
  const unitVal = bottle.estimatedCurrentPrice ?? bottle.purchasePrice;
  const totalValue = unitVal !== undefined ? unitVal * bottle.quantity : undefined;

  return (
    <article
      className={`group flex flex-col justify-between overflow-hidden rounded-2xl border bg-cellar-900/90 transition hover:border-bordeaux-500/60 hover:shadow-xl hover:shadow-black/40 ${
        bottle.quantity === 0 ? 'border-cellar-800/60 opacity-65' : 'border-cellar-700/80'
      }`}
    >
      <div className="flex gap-4 p-4">
        {/* Thumbnail / Placeholder */}
        <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-cellar-700/80 bg-cellar-950">
          {bottle.photoDataUrl ? (
            <img
              src={bottle.photoDataUrl}
              alt={bottle.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-cellar-850 to-cellar-950 p-2 text-center">
              <Wine className="h-7 w-7 text-bordeaux-500/80" />
              {bottle.vintage && (
                <span className="mt-1 font-serif text-xs font-semibold text-gold-400">
                  {bottle.vintage}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Main Info */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-stone-100">
              {bottle.name}
            </h3>
            {bottle.vintage && (
              <span className="shrink-0 rounded-lg border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 font-serif text-xs font-semibold text-gold-400">
                {bottle.vintage}
              </span>
            )}
          </div>

          <p className="truncate text-xs text-stone-400">{bottle.appellation}</p>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${colorStyle.dot}`} />
              {WINE_COLOR_LABELS[bottle.color]}
            </span>

            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tasting.badgeClass}`}
              title={tasting.detail}
            >
              {tasting.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-stone-400">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-bordeaux-500" />
              {cellar?.name ?? 'Cave inconnue'}
              {bottle.rackLocation ? ` • ${bottle.rackLocation}` : ''}
            </span>
            {(bottle.drinkFrom || effectiveDrinkTo) && (
              <span className="text-[11px] text-stone-400">
                Apogée : {bottle.drinkFrom ?? '?'}–{effectiveDrinkTo ?? '?'}
              </span>
            )}
            {bottle.barcode && (
              <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                <Barcode className="h-3 w-3" />
                {bottle.barcode}
              </span>
            )}
          </div>
        </div>
      </div>

      {bottle.foodPairings && bottle.foodPairings.length > 0 && (
        <div className="mx-4 mb-2.5 flex flex-wrap items-center gap-1.5">
          <Utensils className="h-3 w-3 shrink-0 text-gold-400/80" />
          {bottle.foodPairings.slice(0, 4).map((pairing) => (
            <span
              key={pairing}
              className="rounded-md border border-cellar-700/80 bg-cellar-950/80 px-2 py-0.5 text-[11px] text-stone-300"
            >
              {pairing}
            </span>
          ))}
        </div>
      )}

      {bottle.notes && (
        <p className="mx-4 mb-3 line-clamp-2 rounded-lg bg-cellar-950/70 px-3 py-1.5 text-xs italic text-stone-400">
          « {bottle.notes} »
        </p>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-cellar-800/80 bg-cellar-950/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onConsumeOne(bottle.id)}
            disabled={bottle.quantity <= 0}
            className="inline-flex items-center gap-1 rounded-lg border border-bordeaux-700/70 bg-bordeaux-800/50 px-2.5 py-1 text-xs font-medium text-rose-100 transition hover:bg-bordeaux-600 disabled:cursor-not-allowed disabled:opacity-40"
            title="Consommer 1 bouteille (-1)"
          >
            <Minus className="h-3.5 w-3.5" />
            Boire 1
          </button>

          <span className="min-w-[2.5rem] text-center text-sm font-bold text-stone-100">
            {bottle.quantity} <span className="text-xs font-normal text-stone-400">btl</span>
          </span>

          <button
            type="button"
            onClick={() => onAddOne(bottle.id)}
            className="rounded-lg border border-cellar-700 bg-cellar-850 p-1 text-stone-300 transition hover:border-stone-500 hover:text-white"
            title="Ajouter 1 bouteille (+1)"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {unitVal !== undefined && (
            <div className="text-right">
              <div className="text-xs font-semibold text-gold-400">
                {totalValue !== undefined ? formatCurrency(totalValue) : '—'}
              </div>
              <div className="text-[10px] text-stone-500">
                {bottle.estimatedCurrentPrice !== undefined
                  ? `Cote ${formatCurrency(bottle.estimatedCurrentPrice)}`
                  : `${formatCurrency(unitVal)} / u`}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            {onLogTasting && (
              <button
                type="button"
                onClick={() => onLogTasting(bottle)}
                className="rounded-lg p-1.5 text-stone-400 transition hover:bg-amber-950/60 hover:text-gold-400"
                title="Noter une dégustation"
                aria-label="Noter une dégustation"
              >
                <Star className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(bottle)}
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-cellar-800 hover:text-white"
              title="Modifier"
              aria-label="Modifier"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(bottle.id)}
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-950 hover:text-rose-300"
              title="Supprimer"
              aria-label="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
