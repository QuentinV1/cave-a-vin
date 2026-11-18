import React from 'react';
import {
  AlertTriangle,
  Clock,
  Flame,
  Hourglass,
  Sparkles,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react';
import { Bottle, Cellar, TastingEntry, TastingStatus } from '../types/wine';
import {
  computeTastingStatus,
  formatCurrency,
  formatDateTime,
  WINE_COLOR_BADGES,
  WINE_COLOR_LABELS,
} from '../utils/wineUtils';
import { BottleCard } from './BottleCard';

interface TastingViewProps {
  bottles: Bottle[];
  cellars: Cellar[];
  tastings: TastingEntry[];
  onConsumeOne: (bottleId: string) => void;
  onAddOne: (bottleId: string) => void;
  onLogTasting: (bottle: Bottle) => void;
  onDeleteTasting: (tastingId: string) => void;
  onEdit: (bottle: Bottle) => void;
  onDelete: (bottleId: string) => void;
}

const SECTIONS: Array<{
  status: TastingStatus;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}> = [
  {
    status: 'urgent',
    title: 'Urgent / Fin de garde',
    subtitle: 'Bouteilles en fin de fenêtre de dégustation ou apogée dépassée.',
    icon: <Flame className="h-5 w-5 text-orange-400" />,
  },
  {
    status: 'apogee',
    title: 'À boire / Apogée',
    subtitle: 'Prêtes à être dégustées dès maintenant.',
    icon: <Sparkles className="h-5 w-5 text-emerald-400" />,
  },
  {
    status: 'a_garder',
    title: 'À garder',
    subtitle: 'En cours de vieillissement avant leur fenêtre optimale.',
    icon: <Hourglass className="h-5 w-5 text-sky-400" />,
  },
  {
    status: 'inconnu',
    title: 'Fenêtre non définie',
    subtitle: 'Renseignez les années d’apogée pour suivre leur évolution.',
    icon: <Clock className="h-5 w-5 text-stone-400" />,
  },
];

export const TastingView: React.FC<TastingViewProps> = ({
  bottles,
  cellars,
  tastings,
  onConsumeOne,
  onAddOne,
  onLogTasting,
  onDeleteTasting,
  onEdit,
  onDelete,
}) => {
  const inStockBottles = bottles.filter((b) => b.quantity > 0);
  const cellarMap = new Map(cellars.map((c) => [c.id, c]));

  const urgentCount = inStockBottles
    .filter((b) => computeTastingStatus(b).status === 'urgent')
    .reduce((s, b) => s + b.quantity, 0);
  const apogeeCount = inStockBottles
    .filter((b) => computeTastingStatus(b).status === 'apogee')
    .reduce((s, b) => s + b.quantity, 0);

  const avgRating =
    tastings.length > 0
      ? (tastings.reduce((s, t) => s + t.rating, 0) / tastings.length).toFixed(1)
      : null;

  const sortedTastings = [...tastings].sort(
    (a, b) => new Date(b.tastedAt).getTime() - new Date(a.tastedAt).getTime(),
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-stone-100">
          Fenêtres de dégustation & Historique
        </h2>
        <p className="text-sm text-stone-400">
          Priorisez vos ouvertures selon l'apogée, suivez vos alertes de conservation et consultez vos notes de dégustation.
        </p>
      </div>

      {/* Alertes apogée / fin de conservation */}
      {(urgentCount > 0 || apogeeCount > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {urgentCount > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-orange-700/60 bg-orange-950/40 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
              <div>
                <p className="text-sm font-semibold text-orange-200">
                  Alerte fin de conservation ({urgentCount} bouteille{urgentCount > 1 ? 's' : ''})
                </p>
                <p className="text-xs text-orange-300/80">
                  Ces cuvées approchent ou dépassent leur limite de garde : à ouvrir en priorité.
                </p>
              </div>
            </div>
          )}
          {apogeeCount > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-700/50 bg-emerald-950/30 p-4">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-200">
                  À leur apogée ({apogeeCount} bouteille{apogeeCount > 1 ? 's' : ''})
                </p>
                <p className="text-xs text-emerald-300/80">
                  Dans leur fenêtre de dégustation optimale cette année.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {inStockBottles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cellar-700 bg-cellar-900/50 p-10 text-center text-stone-400">
          Aucune bouteille en stock actuellement.
        </div>
      ) : (
        SECTIONS.map((section) => {
          const matching = inStockBottles.filter(
            (b) => computeTastingStatus(b).status === section.status,
          );
          if (matching.length === 0) return null;

          const count = matching.reduce((s, b) => s + b.quantity, 0);
          const value = matching.reduce(
            (s, b) => s + (b.estimatedCurrentPrice ?? b.purchasePrice ?? 0) * b.quantity,
            0,
          );

          return (
            <section key={section.status} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cellar-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  {section.icon}
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-stone-100">
                      {section.title}
                    </h3>
                    <p className="text-xs text-stone-400">{section.subtitle}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-stone-300">
                  <span className="font-semibold">{count} bouteille(s)</span>
                  {value > 0 && (
                    <span className="ml-2 text-gold-400">({formatCurrency(value)})</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {matching.map((bottle) => (
                  <BottleCard
                    key={bottle.id}
                    bottle={bottle}
                    cellar={cellarMap.get(bottle.cellarId)}
                    onConsumeOne={onConsumeOne}
                    onAddOne={onAddOne}
                    onLogTasting={onLogTasting}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* Historique des dégustations (V3) */}
      <section className="space-y-4 border-t border-cellar-800 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-serif text-xl font-semibold text-stone-100">
              Historique des dégustations
            </h3>
            <p className="text-xs text-stone-400">
              Vos notes personnelles, étoiles et accords mémorisés lors des ouvertures.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-300">
            <span>{sortedTastings.length} dégustation(s)</span>
            {avgRating && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 font-semibold text-gold-400">
                <Star className="h-3.5 w-3.5 fill-gold-400" />
                Moyenne {avgRating}/5
              </span>
            )}
          </div>
        </div>

        {sortedTastings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-cellar-800 bg-cellar-900/40 p-6 text-center text-xs text-stone-400">
            Aucune dégustation enregistrée. Cliquez sur l'icône ★ d'une bouteille pour noter votre dégustation.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {sortedTastings.map((entry) => {
              const badge = WINE_COLOR_BADGES[entry.color];
              return (
                <article
                  key={entry.id}
                  className="flex flex-col justify-between rounded-2xl border border-cellar-700/80 bg-cellar-900/80 p-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-serif text-base font-semibold text-stone-100">
                          {entry.bottleName}
                          {entry.vintage ? ` (${entry.vintage})` : ''}
                        </h4>
                        {entry.appellation && (
                          <p className="text-xs text-stone-400">{entry.appellation}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${
                              s <= Math.round(entry.rating)
                                ? 'fill-gold-400 text-gold-400'
                                : 'text-stone-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {WINE_COLOR_LABELS[entry.color]}
                      </span>
                      <span>{formatDateTime(entry.tastedAt)}</span>
                      {entry.occasion && (
                        <span className="rounded-md bg-cellar-950 px-2 py-0.5 text-stone-300">
                          {entry.occasion}
                        </span>
                      )}
                      {entry.foodPairing && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-cellar-950 px-2 py-0.5 text-gold-300">
                          <Utensils className="h-3 w-3" />
                          {entry.foodPairing}
                        </span>
                      )}
                    </div>

                    {entry.notes && (
                      <p className="rounded-lg bg-cellar-950/70 px-3 py-2 text-xs italic text-stone-300">
                        « {entry.notes} »
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onDeleteTasting(entry.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-stone-400 transition hover:bg-rose-950 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
