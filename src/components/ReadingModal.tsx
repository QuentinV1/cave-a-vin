import React, { useEffect, useState } from 'react';
import { Thermometer, Droplets, X } from 'lucide-react';
import { Cellar } from '../types/wine';

interface ReadingModalProps {
  isOpen: boolean;
  cellar: Cellar | null;
  onClose: () => void;
  onSave: (data: {
    cellarId: string;
    temperature: number;
    humidity: number;
    recordedAt: string;
    note?: string;
  }) => void;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const ReadingModal: React.FC<ReadingModalProps> = ({
  isOpen,
  cellar,
  onClose,
  onSave,
}) => {
  const [temperature, setTemperature] = useState('12.5');
  const [humidity, setHumidity] = useState('72');
  const [recordedAt, setRecordedAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !cellar) return;
    setError(null);
    setTemperature(String(((cellar.idealTempMin + cellar.idealTempMax) / 2).toFixed(1)));
    setHumidity(String(Math.round((cellar.idealHumidityMin + cellar.idealHumidityMax) / 2)));
    setRecordedAt(toLocalDateTimeInput(new Date()));
    setNote('');
  }, [isOpen, cellar]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !cellar) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const temp = Number(temperature);
    const hum = Number(humidity);
    if (Number.isNaN(temp) || temp < -10 || temp > 50) {
      setError('Température invalide.');
      return;
    }
    if (Number.isNaN(hum) || hum < 0 || hum > 100) {
      setError('Hygrométrie invalide (0 à 100 %).');
      return;
    }

    const iso = recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString();

    onSave({
      cellarId: cellar.id,
      temperature: temp,
      humidity: hum,
      recordedAt: iso,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-cellar-700 bg-cellar-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-cellar-700/80 px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-stone-100">
              Nouveau relevé
            </h2>
            <p className="text-xs text-stone-400">{cellar.name}</p>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-200">
                <Thermometer className="h-4 w-4 text-rose-400" />
                Température (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2.5 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                required
              />
              <p className="mt-1 text-[11px] text-stone-400">
                Idéal : {cellar.idealTempMin}°C – {cellar.idealTempMax}°C
              </p>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-stone-200">
                <Droplets className="h-4 w-4 text-sky-400" />
                Hygrométrie (%)
              </label>
              <input
                type="number"
                step="1"
                min={0}
                max={100}
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2.5 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                required
              />
              <p className="mt-1 text-[11px] text-stone-400">
                Idéal : {cellar.idealHumidityMin}% – {cellar.idealHumidityMax}%
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-200">
              Date & heure du relevé
            </label>
            <input
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2.5 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-200">
              Note (optionnel)
            </label>
            <input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Après remplissage du bac à eau..."
              className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
            />
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
              className="rounded-xl bg-bordeaux-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-bordeaux-500"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
