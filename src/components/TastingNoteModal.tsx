import React, { useEffect, useState } from 'react';
import { Star, Wine, X } from 'lucide-react';
import { Bottle, TastingEntry } from '../types/wine';

interface TastingNoteModalProps {
  isOpen: boolean;
  bottle: Bottle | null;
  onClose: () => void;
  onSave: (entry: Omit<TastingEntry, 'id'>) => void;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const TastingNoteModal: React.FC<TastingNoteModalProps> = ({
  isOpen,
  bottle,
  onClose,
  onSave,
}) => {
  const [rating, setRating] = useState(4);
  const [occasion, setOccasion] = useState('');
  const [foodPairing, setFoodPairing] = useState('');
  const [notes, setNotes] = useState('');
  const [tastedAt, setTastedAt] = useState('');

  useEffect(() => {
    if (!isOpen || !bottle) return;
    setRating(4);
    setOccasion('');
    setFoodPairing(bottle.foodPairings?.[0] ?? '');
    setNotes('');
    setTastedAt(toLocalDateTimeInput(new Date()));
  }, [isOpen, bottle]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !bottle) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      bottleId: bottle.id,
      bottleName: bottle.name,
      appellation: bottle.appellation,
      vintage: bottle.vintage,
      color: bottle.color,
      cellarId: bottle.cellarId,
      rating,
      tastedAt: tastedAt ? new Date(tastedAt).toISOString() : new Date().toISOString(),
      occasion: occasion.trim() || undefined,
      foodPairing: foodPairing.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-cellar-700 bg-cellar-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-cellar-700/80 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <Wine className="h-5 w-5 text-gold-400" />
            <div>
              <h2 className="font-serif text-lg font-semibold text-stone-100">
                Noter la dégustation
              </h2>
              <p className="text-xs text-stone-400">
                {bottle.name} {bottle.vintage ? `(${bottle.vintage})` : ''}
              </p>
            </div>
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
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Note globale
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="rounded-lg p-1 transition hover:scale-110"
                  aria-label={`${star} étoile(s)`}
                >
                  <Star
                    className={`h-7 w-7 ${
                      star <= rating
                        ? 'fill-gold-400 text-gold-400'
                        : 'text-stone-600'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-semibold text-gold-400">
                {rating} / 5
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Date de dégustation
            </label>
            <input
              type="datetime-local"
              value={tastedAt}
              onChange={(e) => setTastedAt(e.target.value)}
              className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                Occasion
              </label>
              <input
                type="text"
                maxLength={80}
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Ex: Dîner, Anniversaire..."
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                Plat dégusté avec
              </label>
              <input
                type="text"
                maxLength={100}
                value={foodPairing}
                onChange={(e) => setFoodPairing(e.target.value)}
                placeholder="Ex: Magret, Fromages..."
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
              Impressions & arômes
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nez, bouche, équilibre, évolution..."
              className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-cellar-700 px-4 py-2 text-sm font-medium text-stone-300 transition hover:bg-cellar-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-xl bg-bordeaux-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-bordeaux-500"
            >
              Enregistrer la note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
