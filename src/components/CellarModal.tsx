import React, { useEffect, useState } from 'react';
import { Warehouse, X } from 'lucide-react';
import { Cellar } from '../types/wine';

interface CellarModalProps {
  isOpen: boolean;
  editingCellar: Cellar | null;
  onClose: () => void;
  onSave: (data: Omit<Cellar, 'id' | 'createdAt'>, existingId?: string) => void;
}

export const CellarModal: React.FC<CellarModalProps> = ({
  isOpen,
  editingCellar,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [rackRows, setRackRows] = useState('5');
  const [rackCols, setRackCols] = useState('6');
  const [idealTempMin, setIdealTempMin] = useState('11');
  const [idealTempMax, setIdealTempMax] = useState('14');
  const [idealHumidityMin, setIdealHumidityMin] = useState('65');
  const [idealHumidityMax, setIdealHumidityMax] = useState('80');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingCellar) {
      setName(editingCellar.name);
      setLocation(editingCellar.location ?? '');
      setCapacity(editingCellar.capacity ? String(editingCellar.capacity) : '');
      setRackRows(String(editingCellar.rackRows ?? 5));
      setRackCols(String(editingCellar.rackCols ?? 6));
      setIdealTempMin(String(editingCellar.idealTempMin));
      setIdealTempMax(String(editingCellar.idealTempMax));
      setIdealHumidityMin(String(editingCellar.idealHumidityMin));
      setIdealHumidityMax(String(editingCellar.idealHumidityMax));
    } else {
      setName('');
      setLocation('');
      setCapacity('');
      setRackRows('5');
      setRackCols('6');
      setIdealTempMin('11');
      setIdealTempMax('14');
      setIdealHumidityMin('65');
      setIdealHumidityMax('80');
    }
  }, [isOpen, editingCellar]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom de la cave est obligatoire.');
      return;
    }

    const tMin = Number(idealTempMin);
    const tMax = Number(idealTempMax);
    const hMin = Number(idealHumidityMin);
    const hMax = Number(idealHumidityMax);

    if (Number.isNaN(tMin) || Number.isNaN(tMax) || tMin > tMax) {
      setError('La plage de température idéale est invalide (min ≤ max).');
      return;
    }
    if (Number.isNaN(hMin) || Number.isNaN(hMax) || hMin > hMax || hMin < 0 || hMax > 100) {
      setError("La plage d'hygrométrie idéale est invalide (0–100%, min ≤ max).");
      return;
    }

    const parsedCap = capacity.trim() ? Number(capacity) : undefined;
    const parsedRows = Math.min(12, Math.max(1, Math.round(Number(rackRows) || 5)));
    const parsedCols = Math.min(12, Math.max(1, Math.round(Number(rackCols) || 6)));

    onSave(
      {
        name: trimmedName,
        location: location.trim() || undefined,
        capacity: parsedCap && parsedCap > 0 ? Math.round(parsedCap) : undefined,
        rackRows: parsedRows,
        rackCols: parsedCols,
        idealTempMin: tMin,
        idealTempMax: tMax,
        idealHumidityMin: hMin,
        idealHumidityMax: hMax,
      },
      editingCellar?.id,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-cellar-700 bg-cellar-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-cellar-700/80 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <Warehouse className="h-5 w-5 text-gold-400" />
            <h2 className="font-serif text-xl font-semibold text-stone-100">
              {editingCellar ? 'Modifier la cave' : 'Nouvelle cave'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-cellar-800 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="rounded-xl border border-red-700/60 bg-red-950/60 px-4 py-2.5 text-sm text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-200">
              Nom de la cave *
            </label>
            <input
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Cave principale, Cave de service..."
              className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-200">
                Emplacement
              </label>
              <input
                type="text"
                maxLength={80}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Sous-sol, Cuisine..."
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-200">
                Capacité (bouteilles)
              </label>
              <input
                type="number"
                min={1}
                max={99999}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Ex: 150"
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-300">
                Plan casiers : Rangées (A, B, C...)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={rackRows}
                onChange={(e) => setRackRows(e.target.value)}
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-300">
                Plan casiers : Colonnes (1, 2, 3...)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={rackCols}
                onChange={(e) => setRackCols(e.target.value)}
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-cellar-700/70 bg-cellar-950/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold-400">
              Plages idéales (alertes automatiques)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-stone-400">T° min (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={idealTempMin}
                  onChange={(e) => setIdealTempMin(e.target.value)}
                  className="w-full rounded-lg border border-cellar-700 bg-cellar-900 px-3 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-stone-400">T° max (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={idealTempMax}
                  onChange={(e) => setIdealTempMax(e.target.value)}
                  className="w-full rounded-lg border border-cellar-700 bg-cellar-900 px-3 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-stone-400">Hygro min (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={idealHumidityMin}
                  onChange={(e) => setIdealHumidityMin(e.target.value)}
                  className="w-full rounded-lg border border-cellar-700 bg-cellar-900 px-3 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-stone-400">Hygro max (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={idealHumidityMax}
                  onChange={(e) => setIdealHumidityMax(e.target.value)}
                  className="w-full rounded-lg border border-cellar-700 bg-cellar-900 px-3 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-cellar-700 px-4 py-2.5 text-sm font-medium text-stone-300 transition hover:bg-cellar-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-xl bg-bordeaux-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-bordeaux-800/30 transition hover:bg-bordeaux-500"
            >
              {editingCellar ? 'Enregistrer' : 'Créer la cave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
