import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Edit3,
  Plus,
  Thermometer,
  Trash2,
  Warehouse,
} from 'lucide-react';
import { Bottle, Cellar, CellarReading } from '../types/wine';
import { evaluateReading, formatCurrency, formatDateTime } from '../utils/wineUtils';

interface CellarsViewProps {
  cellars: Cellar[];
  readings: CellarReading[];
  bottles: Bottle[];
  onAddCellar: () => void;
  onEditCellar: (cellar: Cellar) => void;
  onDeleteCellar: (cellarId: string) => void;
  onAddReading: (cellar: Cellar) => void;
  onDeleteReading: (readingId: string) => void;
}

export const CellarsView: React.FC<CellarsViewProps> = ({
  cellars,
  readings,
  bottles,
  onAddCellar,
  onEditCellar,
  onDeleteCellar,
  onAddReading,
  onDeleteReading,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-stone-100">
            Mes caves & Conditions
          </h2>
          <p className="text-sm text-stone-400">
            Suivi manuel de la température (°C), de l'hygrométrie (%) et valorisation par cave.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddCellar}
          className="inline-flex items-center gap-2 rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-bordeaux-800/30 transition hover:bg-bordeaux-500"
        >
          <Plus className="h-4 w-4" />
          Nouvelle cave
        </button>
      </div>

      {cellars.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cellar-700 bg-cellar-900/50 p-10 text-center">
          <Warehouse className="mx-auto mb-3 h-10 w-10 text-stone-500" />
          <p className="text-stone-300">Aucune cave enregistrée.</p>
          <p className="mt-1 text-sm text-stone-500">
            Créez votre première cave pour commencer à suivre votre stock et vos relevés.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {cellars.map((cellar) => {
            const cellarBottles = bottles.filter((b) => b.cellarId === cellar.id);
            const totalBottles = cellarBottles.reduce((sum, b) => sum + b.quantity, 0);
            const cellarValue = cellarBottles.reduce(
              (sum, b) => sum + (b.purchasePrice ?? 0) * b.quantity,
              0,
            );
            const cellarReadings = readings
              .filter((r) => r.cellarId === cellar.id)
              .sort(
                (a, b) =>
                  new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
              );
            const latestReading = cellarReadings[0];
            const latestEval = latestReading
              ? evaluateReading(latestReading, cellar)
              : null;

            const fillPercent =
              cellar.capacity && cellar.capacity > 0
                ? Math.min(100, Math.round((totalBottles / cellar.capacity) * 100))
                : null;

            return (
              <section
                key={cellar.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-cellar-700/80 bg-cellar-900/90 shadow-lg"
              >
                {/* Cellar Header */}
                <div className="flex items-start justify-between border-b border-cellar-800 px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-5 w-5 text-gold-400" />
                      <h3 className="font-serif text-xl font-semibold text-stone-100">
                        {cellar.name}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {cellar.location ? `${cellar.location} • ` : ''}
                      Idéal : {cellar.idealTempMin}–{cellar.idealTempMax}°C /{' '}
                      {cellar.idealHumidityMin}–{cellar.idealHumidityMax}%
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditCellar(cellar)}
                      className="rounded-lg p-1.5 text-stone-400 transition hover:bg-cellar-800 hover:text-white"
                      title="Modifier la cave"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCellar(cellar.id)}
                      className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-950 hover:text-rose-300"
                      title="Supprimer la cave"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 border-b border-cellar-800/80 bg-cellar-950/40 px-5 py-3.5 sm:grid-cols-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-stone-500">
                      Bouteilles
                    </div>
                    <div className="mt-0.5 text-lg font-bold text-stone-100">
                      {totalBottles}
                      {cellar.capacity ? (
                        <span className="text-xs font-normal text-stone-400">
                          {' '}
                          / {cellar.capacity}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-stone-500">
                      Valeur
                    </div>
                    <div className="mt-0.5 text-lg font-bold text-gold-400">
                      {formatCurrency(cellarValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-stone-500">
                      Température
                    </div>
                    <div
                      className={`mt-0.5 flex items-center gap-1 text-lg font-bold ${
                        latestEval?.tempStatus !== 'ok' && latestReading
                          ? 'text-amber-400'
                          : 'text-stone-100'
                      }`}
                    >
                      <Thermometer className="h-4 w-4 text-rose-400" />
                      {latestReading ? `${latestReading.temperature}°C` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-stone-500">
                      Hygrométrie
                    </div>
                    <div
                      className={`mt-0.5 flex items-center gap-1 text-lg font-bold ${
                        latestEval?.humidityStatus !== 'ok' && latestReading
                          ? 'text-amber-400'
                          : 'text-stone-100'
                      }`}
                    >
                      <Droplets className="h-4 w-4 text-sky-400" />
                      {latestReading ? `${latestReading.humidity}%` : '—'}
                    </div>
                  </div>
                </div>

                {fillPercent !== null && (
                  <div className="px-5 pt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-stone-400">
                      <span>Remplissage</span>
                      <span>{fillPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-cellar-950">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-bordeaux-600 to-gold-500 transition-all"
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Alert Banner */}
                <div className="px-5 pt-4">
                  {latestReading && latestEval ? (
                    latestEval.hasAlert ? (
                      <div className="flex items-start gap-2.5 rounded-xl border border-amber-700/60 bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <div>
                          <p className="font-semibold">Alerte conditions hors plage idéale</p>
                          <ul className="mt-0.5 list-disc pl-4 text-amber-200/90">
                            {latestEval.messages.map((msg) => (
                              <li key={msg}>{msg}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-3.5 py-2 text-xs text-emerald-200">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        Conditions idéales (dernier relevé : {formatDateTime(latestReading.recordedAt)})
                      </div>
                    )
                  ) : (
                    <div className="rounded-xl border border-cellar-800 bg-cellar-950/50 px-3.5 py-2 text-xs text-stone-400">
                      Aucun relevé de température ou d'hygrométrie enregistré.
                    </div>
                  )}
                </div>

                {/* Readings History */}
                <div className="flex-1 space-y-2.5 p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Historique des relevés ({cellarReadings.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => onAddReading(cellar)}
                      className="inline-flex items-center gap-1 rounded-lg border border-bordeaux-700/70 bg-bordeaux-800/40 px-2.5 py-1 text-xs font-medium text-rose-100 transition hover:bg-bordeaux-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Relevé T°/Hygro
                    </button>
                  </div>

                  {cellarReadings.length > 0 && (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                      {cellarReadings.map((reading) => {
                        const evalRes = evaluateReading(reading, cellar);
                        return (
                          <div
                            key={reading.id}
                            className="flex items-center justify-between rounded-xl border border-cellar-800/80 bg-cellar-950/60 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-stone-200">
                                  {reading.temperature}°C
                                </span>
                                <span className="text-stone-600">•</span>
                                <span className="font-medium text-stone-200">
                                  {reading.humidity}%
                                </span>
                                {evalRes.hasAlert && (
                                  <span className="rounded bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                                    Hors plage
                                  </span>
                                )}
                                <span className="text-[11px] text-stone-500">
                                  {formatDateTime(reading.recordedAt)}
                                </span>
                              </div>
                              {reading.note && (
                                <p className="mt-0.5 truncate text-[11px] text-stone-400">
                                  {reading.note}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onDeleteReading(reading.id)}
                              className="ml-2 rounded p-1 text-stone-500 transition hover:bg-rose-950 hover:text-rose-300"
                              title="Supprimer ce relevé"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
