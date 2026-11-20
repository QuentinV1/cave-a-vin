import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { CellarBackupData } from '../types/wine';
import { AppStateData, buildBackupPayload, parseBackupPayload } from '../utils/storage';

interface BackupViewProps {
  data: AppStateData;
  onImportReplace: (backup: CellarBackupData) => void;
  onResetDemo: () => void;
  onClearAll: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  data,
  onImportReplace,
  onResetDemo,
  onClearAll,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<CellarBackupData | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-stone-100">
          Sauvegarde & Données Cloud
        </h2>
        <p className="text-sm text-stone-400">
          Toutes vos données (caves, relevés T°/hygro, bouteilles et photos) sont stockées dans votre espace personnel et synchronisées sur vos appareils.
        </p>
      </div>

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
              Restaurez une sauvegarde précédemment exportée. Vous pourrez vérifier son contenu avant de l'appliquer.
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
            <strong>{pendingBackup.readings.length} relevé(s)</strong>. L'import remplacera les
            données actuelles.
          </p>
          <div className="mt-4 flex justify-end gap-3">
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
                  'Réinitialiser avec les données de démonstration ? Vos données actuelles seront remplacées.',
                )
              ) {
                onResetDemo();
                setFeedback({
                  type: 'success',
                  text: 'Données de démonstration restaurées.',
                });
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-xs font-medium text-stone-300 transition hover:border-stone-500 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurer les données de démo
          </button>

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
                  text: 'Toutes les données locales ont été effacées.',
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
    </div>
  );
};
