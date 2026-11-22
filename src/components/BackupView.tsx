import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  FileJson,
  LayoutGrid,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CellarBackupData } from '../types/wine';
import { CloudState } from '../utils/firestoreStorage';
import { AppStateData, buildBackupPayload, parseBackupPayload } from '../utils/storage';

interface BackupViewProps {
  data: AppStateData;
  user?: User | null;
  cloudState?: CloudState;
  onOpenAuthModal?: () => void;
  onForceSync?: () => Promise<void>;
  onImportReplace: (backup: CellarBackupData) => void;
  onClearAll: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  data,
  user,
  cloudState,
  onOpenAuthModal,
  onForceSync,
  onImportReplace,
  onClearAll,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<CellarBackupData | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [syncingNow, setSyncingNow] = useState(false);
  const [showOtherApps, setShowOtherApps] = useState(false);

  useEffect(() => {
    if (!showOtherApps) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOtherApps(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOtherApps]);

  const handleExport = () => {
    const payload = buildBackupPayload(data);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cave-a-vin-sauvegarde-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'success',
      text: `Sauvegarde exportée (${payload.cellars.length} cave(s), ${payload.bottles.length} référence(s), ${payload.readings.length} relevé(s)).`,
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const text = await file.text();
      const parsed = parseBackupPayload(text);
      setPendingBackup(parsed);
    } catch (err) {
      setPendingBackup(null);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Fichier JSON invalide.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const confirmImport = () => {
    if (!pendingBackup) return;
    onImportReplace(pendingBackup);
    setFeedback({
      type: 'success',
      text: `Import réussi : ${pendingBackup.cellars.length} cave(s), ${pendingBackup.bottles.length} référence(s), ${pendingBackup.readings.length} relevé(s).`,
    });
    setPendingBackup(null);
  };

  const handleSyncClick = async () => {
    if (!onForceSync) return;
    setSyncingNow(true);
    setFeedback(null);
    try {
      await onForceSync();
      setFeedback({
        type: 'success',
        text: 'Synchronisation Cloud effectuée avec succès.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erreur de synchronisation Cloud.',
      });
    } finally {
      setSyncingNow(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-stone-100">
          Sauvegarde & Synchronisation Cloud
        </h2>
        <p className="text-sm text-stone-400">
          Vos données sont enregistrées instantanément sur cet appareil (local-first) et synchronisées avec votre compte Cloud si vous êtes connecté.
        </p>
      </div>

      {/* Compte Cloud & Synchronisation */}
      {onOpenAuthModal && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cellar-700/80 bg-cellar-900/90 p-4 sm:p-5">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 text-gold-400">
              <Cloud className="h-5 w-5 shrink-0" />
              <h3 className="font-serif text-lg font-semibold text-stone-100">
                Compte Cloud & Synchronisation
              </h3>
            </div>
            {user ? (
              <div className="text-xs text-stone-300">
                Connecté en tant que{' '}
                <strong className="break-all text-stone-100">
                  {user.email || user.displayName || user.uid}
                </strong>
                {cloudState?.syncStatus === 'error' && cloudState.syncError && (
                  <div className="mt-1 text-red-300">{cloudState.syncError}</div>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-400">
                Mode local actif. Connectez-vous pour synchroniser votre cave entre vos appareils.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user && onForceSync && (
              <button
                type="button"
                disabled={syncingNow || cloudState?.syncStatus === 'syncing'}
                onClick={() => void handleSyncClick()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-xs font-medium text-stone-200 transition hover:border-bordeaux-500 hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    syncingNow || cloudState?.syncStatus === 'syncing' ? 'animate-spin' : ''
                  }`}
                />
                Synchroniser maintenant
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-2 rounded-xl bg-bordeaux-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-bordeaux-500"
            >
              <Cloud className="h-3.5 w-3.5" />
              {user ? 'Gérer le compte Cloud' : 'Se connecter au Cloud'}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200'
              : 'border-red-700/60 bg-red-950/50 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          )}
          <p>{feedback.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Export */}
        <div className="flex flex-col justify-between rounded-2xl border border-cellar-700/80 bg-cellar-900/90 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gold-400">
              <Download className="h-5 w-5" />
              <h3 className="font-serif text-lg font-semibold text-stone-100">
                Exporter en JSON
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-stone-400">
              Téléchargez une sauvegarde complète de vos caves, relevés climatiques, bouteilles et photos encodées.
            </p>
            <div className="rounded-xl bg-cellar-950/70 px-3 py-2 text-xs text-stone-300">
              Contenu actuel : {data.cellars.length} cave(s) • {data.bottles.length} référence(s) •{' '}
              {data.readings.length} relevé(s)
            </div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bordeaux-500"
          >
            <FileJson className="h-4 w-4" />
            Télécharger la sauvegarde
          </button>
        </div>

        {/* Import */}
        <div className="flex flex-col justify-between rounded-2xl border border-cellar-700/80 bg-cellar-900/90 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gold-400">
              <Upload className="h-5 w-5" />
              <h3 className="font-serif text-lg font-semibold text-stone-100">
                Importer un JSON
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-stone-400">
              Restaurez une sauvegarde précédemment exportée. Vous pourrez vérifier son contenu avant de l&apos;appliquer.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cellar-700 bg-cellar-850 px-4 py-2.5 text-sm font-semibold text-stone-100 transition hover:border-bordeaux-500 hover:bg-cellar-800"
          >
            <Upload className="h-4 w-4" />
            Choisir un fichier .json
          </button>
        </div>
      </div>

      {pendingBackup && (
        <div className="rounded-2xl border border-gold-500/50 bg-cellar-900 p-5 shadow-xl">
          <h4 className="font-serif text-base font-semibold text-gold-400">
            Confirmer la restauration
          </h4>
          <p className="mt-1 text-xs text-stone-300">
            Ce fichier contient{' '}
            <strong>{pendingBackup.cellars.length} cave(s)</strong>,{' '}
            <strong>{pendingBackup.bottles.length} référence(s)</strong> et{' '}
            <strong>{pendingBackup.readings.length} relevé(s)</strong>. L&apos;import remplacera les
            données actuelles.
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => setPendingBackup(null)}
              className="rounded-xl border border-cellar-700 px-4 py-2 text-xs font-medium text-stone-300 hover:bg-cellar-800"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmImport}
              className="rounded-xl bg-bordeaux-600 px-4 py-2 text-xs font-semibold text-white hover:bg-bordeaux-500"
            >
              Remplacer et restaurer
            </button>
          </div>
        </div>
      )}

      {/* Maintenance */}
      <div className="rounded-2xl border border-cellar-800 bg-cellar-900/60 p-5">
        <h3 className="text-sm font-semibold text-stone-200">Maintenance</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Tout effacer ? Toutes vos caves, bouteilles et relevés seront supprimés.',
                )
              ) {
                onClearAll();
                setFeedback({
                  type: 'success',
                  text: 'Toutes les données ont été effacées.',
                });
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-900/60 bg-rose-950/40 px-3.5 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-900/60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Tout effacer
          </button>
        </div>
      </div>

      {/* Mes autres applications */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cellar-800 bg-cellar-900/60 p-5">
        <div>
          <h3 className="text-sm font-semibold text-stone-100">Mes autres applications</h3>
          <p className="mt-0.5 text-xs text-stone-400">
            Accéder rapidement aux autres applications web (GitHub Pages).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowOtherApps(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-wine-500/40 bg-wine-950/60 px-4 py-2 text-xs font-semibold text-wine-200 transition hover:bg-wine-900/60"
        >
          <LayoutGrid className="h-4 w-4" />
          Mes autres applications
        </button>
      </div>

      {showOtherApps && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-4"
          onClick={() => setShowOtherApps(false)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-cellar-700 bg-cellar-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cellar-800 px-5 py-4">
              <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-stone-100">
                <LayoutGrid className="h-4 w-4 text-wine-400" />
                Mes autres applications
              </h3>
              <button
                type="button"
                onClick={() => setShowOtherApps(false)}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-stone-400 hover:bg-cellar-800 hover:text-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
              <p className="text-xs text-stone-400">
                Retrouvez toutes les autres applications hébergées sur GitHub Pages.
              </p>
              <div className="grid gap-2">
                {[
                  { name: "L'Affinoir", desc: "Charcuterie, salaisons & cave d'affinage", url: 'https://quentinv1.github.io/app-charcuterie/' },
                  { name: 'Pêche France', desc: 'Réglementation, mailles, cartes & carnet de prises', url: 'https://quentinv1.github.io/app-peche/' },
                  { name: 'App Voyage', desc: "Planificateur d'itinéraire, carte & carnet de voyage", url: 'https://quentinv1.github.io/app-voyage/' },
                  { name: 'Budget Prévisionnel', desc: 'Budget du foyer, provisions & projections', url: 'https://quentinv1.github.io/budget-previsionnel/' },
                  { name: 'Checklist Valise', desc: 'Bagages, calculateur de poids & règles IATA', url: 'https://quentinv1.github.io/checklist-valise/' },
                  { name: 'Livre de recettes', desc: 'Recettes, planning semaine & liste de courses', url: 'https://quentinv1.github.io/livre-recettes/' },
                  { name: 'Suivi Chasse', desc: 'Carnet de sorties, carte & album trophées', url: 'https://quentinv1.github.io/suivi-chasse/' },
                  { name: 'Travaux Maison', desc: 'Plan 2D/3D, courses, tâches & entretien', url: 'https://quentinv1.github.io/travaux-maison/' },
                ].map((app) => (
                  <a
                    key={app.url}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-cellar-800 bg-cellar-950/70 px-3.5 py-2.5 transition hover:border-wine-500/50 hover:bg-cellar-800/70"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-100">{app.name}</div>
                      <div className="truncate text-xs text-stone-400">{app.desc}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-wine-300">
                      Ouvrir <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <div className="flex justify-end border-t border-cellar-800 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowOtherApps(false)}
                className="rounded-xl border border-cellar-700 bg-cellar-950 px-4 py-2 text-xs font-medium text-stone-300 hover:text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
