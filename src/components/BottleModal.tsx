import React, { useEffect, useRef, useState } from 'react';
import {
  Barcode,
  Camera,
  ImagePlus,
  KeyRound,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Wine,
  X,
} from 'lucide-react';
import { Bottle, Cellar, WineColor } from '../types/wine';
import { compressImageToWebP } from '../utils/imageUtils';
import { WINE_COLOR_LABELS } from '../utils/wineUtils';
import {
  estimateWineTastingWindow,
  estimateWineWindowLocally,
  getGeminiApiKey,
  hasGeminiApiKey,
  identifyWineFromLabelImage,
  setGeminiApiKey,
} from '../utils/aiWineService';
import { lookupBottleByBarcode } from '../utils/barcodeLookupService';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface BottleModalProps {
  isOpen: boolean;
  editingBottle: Bottle | null;
  cellars: Cellar[];
  existingBottles?: Bottle[];
  defaultCellarId?: string;
  onClose: () => void;
  onSave: (
    data: Omit<Bottle, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
  ) => void;
}

export const BottleModal: React.FC<BottleModalProps> = ({
  isOpen,
  editingBottle,
  cellars,
  existingBottles = [],
  defaultCellarId,
  onClose,
  onSave,
}) => {
  const [cellarId, setCellarId] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState<WineColor>('rouge');
  const [vintage, setVintage] = useState('');
  const [appellation, setAppellation] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [rackLocation, setRackLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [estimatedCurrentPrice, setEstimatedCurrentPrice] = useState('');
  const [drinkFrom, setDrinkFrom] = useState('');
  const [drinkTo, setDrinkTo] = useState('');
  const [maxKeepYears, setMaxKeepYears] = useState('');
  const [foodPairingsText, setFoodPairingsText] = useState('');
  const [barcode, setBarcode] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const [isCompressing, setIsCompressing] = useState(false);
  const [isIdentifyingLabel, setIsIdentifyingLabel] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [barcodeFeedback, setBarcodeFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [isEstimatingAi, setIsEstimatingAi] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastLookedUpCodeRef = useRef<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setBarcodeFeedback(null);
    setAiFeedback(null);
    setShowApiKeyInput(false);
    setApiKeyDraft(getGeminiApiKey());
    lastLookedUpCodeRef.current = editingBottle?.barcode?.trim() ?? '';
    if (editingBottle) {
      setCellarId(editingBottle.cellarId);
      setName(editingBottle.name);
      setColor(editingBottle.color);
      setVintage(editingBottle.vintage ? String(editingBottle.vintage) : '');
      setAppellation(editingBottle.appellation);
      setQuantity(String(editingBottle.quantity));
      setRackLocation(editingBottle.rackLocation ?? '');
      setPurchasePrice(
        editingBottle.purchasePrice !== undefined ? String(editingBottle.purchasePrice) : '',
      );
      setEstimatedCurrentPrice(
        editingBottle.estimatedCurrentPrice !== undefined
          ? String(editingBottle.estimatedCurrentPrice)
          : '',
      );
      setDrinkFrom(editingBottle.drinkFrom ? String(editingBottle.drinkFrom) : '');
      setDrinkTo(editingBottle.drinkTo ? String(editingBottle.drinkTo) : '');
      setMaxKeepYears(editingBottle.maxKeepYears ? String(editingBottle.maxKeepYears) : '');
      setFoodPairingsText((editingBottle.foodPairings ?? []).join(', '));
      setBarcode(editingBottle.barcode ?? '');
      setPhotoDataUrl(editingBottle.photoDataUrl);
      setNotes(editingBottle.notes ?? '');
    } else {
      setCellarId(defaultCellarId || cellars[0]?.id || '');
      setName('');
      setColor('rouge');
      setVintage(String(new Date().getFullYear() - 2));
      setAppellation('');
      setQuantity('1');
      setRackLocation('');
      setPurchasePrice('');
      setEstimatedCurrentPrice('');
      setDrinkFrom('');
      setDrinkTo('');
      setMaxKeepYears('');
      setFoodPairingsText('');
      setBarcode('');
      setPhotoDataUrl(undefined);
      setNotes('');
    }
  }, [isOpen, editingBottle, cellars, defaultCellarId]);

  useEffect(() => {
    if (!isOpen || scannerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, scannerOpen, onClose]);

  if (!isOpen) return null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    setError(null);
    try {
      const compressed = await compressImageToWebP(file, 720, 0.72);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du traitement de l'image.");
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleBarcodeLookup = async (rawCode: string, force = false) => {
    const clean = rawCode.replace(/\s+/g, '').trim();
    if (!clean) return;
    if (!force && clean === lastLookedUpCodeRef.current) return;

    lastLookedUpCodeRef.current = clean;
    setIsLookingUpBarcode(true);
    setBarcodeFeedback(null);

    try {
      const result = await lookupBottleByBarcode(clean, existingBottles);
      if (result.found && result.data) {
        const d = result.data;
        if (d.name) setName(d.name);
        if (d.color) setColor(d.color);
        if (d.appellation) setAppellation(d.appellation);
        if (d.vintage) setVintage(String(d.vintage));
        if (d.purchasePrice !== undefined) setPurchasePrice(String(d.purchasePrice));
        if (d.drinkFrom) setDrinkFrom(String(d.drinkFrom));
        if (d.drinkTo) setDrinkTo(String(d.drinkTo));
        if (d.maxKeepYears) setMaxKeepYears(String(d.maxKeepYears));
        if (d.notes && !notes.trim()) setNotes(d.notes);
        setBarcodeFeedback({ type: 'success', text: result.message });
      } else {
        setBarcodeFeedback({ type: 'info', text: result.message });
      }
    } catch {
      setBarcodeFeedback({
        type: 'error',
        text: 'Erreur lors de la recherche du code-barres.',
      });
    } finally {
      setIsLookingUpBarcode(false);
    }
  };

  const handleBarcodeInputChange = (value: string) => {
    setBarcode(value);
    const clean = value.replace(/\s+/g, '').trim();
    if (/^\d{8}$|^\d{12,13}$/.test(clean)) {
      void handleBarcodeLookup(clean);
    }
  };

  const handleEstimateWithAi = async () => {
    if (!name.trim() && !appellation.trim()) {
      setError("Saisissez au moins le nom du vin ou l'appellation pour lancer l'estimation.");
      return;
    }
    setError(null);
    setIsEstimatingAi(true);
    setAiFeedback(null);

    try {
      const parsedVintage = vintage.trim() ? Number(vintage) : undefined;
      const parsedPurchase = purchasePrice.trim() ? Number(purchasePrice) : undefined;
      const result = await estimateWineTastingWindow({
        name: name.trim(),
        color,
        appellation: appellation.trim(),
        vintage: parsedVintage && parsedVintage > 1900 ? Math.round(parsedVintage) : undefined,
        purchasePrice: parsedPurchase && parsedPurchase > 0 ? parsedPurchase : undefined,
      });

      setDrinkFrom(String(result.drinkFrom));
      setDrinkTo(String(result.drinkTo));
      setMaxKeepYears(String(result.maxKeepYears));
      if (!estimatedCurrentPrice.trim() && result.estimatedCurrentPrice > 0) {
        setEstimatedCurrentPrice(String(result.estimatedCurrentPrice));
      }
      if (!foodPairingsText.trim() && result.foodPairings.length > 0) {
        setFoodPairingsText(result.foodPairings.join(', '));
      }
      if (!notes.trim() && result.notes) {
        setNotes(result.notes);
      }

      const sourceLabel = result.source === 'gemini' ? 'Gemini AI' : 'Estimation œnologique locale';
      setAiFeedback(
        result.warning
          ? `${result.warning} (${result.explanation})`
          : `${sourceLabel} : ${result.explanation}`,
      );
    } finally {
      setIsEstimatingAi(false);
    }
  };

  const handleIdentifyLabel = async () => {
    if (!photoDataUrl) return;
    setError(null);
    setIsIdentifyingLabel(true);
    setAiFeedback(null);
    try {
      const info = await identifyWineFromLabelImage(photoDataUrl);
      setName(info.name);
      setColor(info.color);
      if (info.appellation) setAppellation(info.appellation);
      if (info.vintage) setVintage(String(info.vintage));
      if (info.estimatedCurrentPrice) setEstimatedCurrentPrice(String(info.estimatedCurrentPrice));
      if (info.drinkFrom) setDrinkFrom(String(info.drinkFrom));
      if (info.drinkTo) setDrinkTo(String(info.drinkTo));
      if (info.maxKeepYears) setMaxKeepYears(String(info.maxKeepYears));
      if (info.foodPairings?.length) setFoodPairingsText(info.foodPairings.join(', '));
      if (info.notes && !notes.trim()) setNotes(info.notes);
      setAiFeedback(`Étiquette identifiée : ${info.confidenceNote}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'analyser l'étiquette.");
    } finally {
      setIsIdentifyingLabel(false);
    }
  };

  const handleSaveApiKey = () => {
    setGeminiApiKey(apiKeyDraft);
    setShowApiKeyInput(false);
    setAiFeedback(
      apiKeyDraft.trim()
        ? 'Clé API Gemini enregistrée localement. Cliquez sur « Remplir par IA » pour interroger Gemini.'
        : 'Clé API Gemini supprimée (mode estimation locale actif).',
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cellarId) {
      setError('Veuillez sélectionner ou créer une cave au préalable.');
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom du vin ou domaine est obligatoire.');
      return;
    }
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty < 0) {
      setError('La quantité doit être supérieure ou égale à 0.');
      return;
    }

    const parsedVintage = vintage.trim() ? Number(vintage) : undefined;
    const parsedPrice = purchasePrice.trim() ? Number(purchasePrice) : undefined;
    let parsedEstPrice = estimatedCurrentPrice.trim() ? Number(estimatedCurrentPrice) : undefined;
    let parsedFrom = drinkFrom.trim() ? Number(drinkFrom) : undefined;
    let parsedTo = drinkTo.trim() ? Number(drinkTo) : undefined;
    let parsedMaxKeep = maxKeepYears.trim() ? Number(maxKeepYears) : undefined;
    let parsedPairings = foodPairingsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    let finalNotes = notes.trim() || undefined;

    if (!editingBottle && (!parsedFrom || !parsedTo || !parsedMaxKeep || parsedPairings.length === 0)) {
      const autoEst = estimateWineWindowLocally({
        name: trimmedName,
        color,
        appellation: appellation.trim(),
        vintage: parsedVintage && parsedVintage > 1900 ? Math.round(parsedVintage) : undefined,
        purchasePrice: parsedPrice !== undefined && parsedPrice > 0 ? parsedPrice : undefined,
      });
      if (!parsedFrom) parsedFrom = autoEst.drinkFrom;
      if (!parsedTo) parsedTo = autoEst.drinkTo;
      if (!parsedMaxKeep) parsedMaxKeep = autoEst.maxKeepYears;
      if (parsedEstPrice === undefined && autoEst.estimatedCurrentPrice > 0) {
        parsedEstPrice = autoEst.estimatedCurrentPrice;
      }
      if (parsedPairings.length === 0) parsedPairings = autoEst.foodPairings;
      if (!finalNotes && autoEst.notes) {
        finalNotes = autoEst.notes;
      }
    }

    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      setError("L'année de début d'apogée doit être antérieure ou égale à l'année de fin.");
      return;
    }

    onSave(
      {
        cellarId,
        name: trimmedName,
        color,
        vintage: parsedVintage && parsedVintage > 1900 ? Math.round(parsedVintage) : undefined,
        appellation: appellation.trim() || 'Non précisée',
        quantity: Math.round(qty),
        rackLocation: rackLocation.trim() || undefined,
        purchasePrice: parsedPrice !== undefined && parsedPrice >= 0 ? parsedPrice : undefined,
        estimatedCurrentPrice:
          parsedEstPrice !== undefined && parsedEstPrice >= 0 ? parsedEstPrice : undefined,
        drinkFrom: parsedFrom && parsedFrom > 1900 ? Math.round(parsedFrom) : undefined,
        drinkTo: parsedTo && parsedTo > 1900 ? Math.round(parsedTo) : undefined,
        maxKeepYears: parsedMaxKeep && parsedMaxKeep > 0 ? Math.round(parsedMaxKeep) : undefined,
        foodPairings: parsedPairings.length > 0 ? parsedPairings : undefined,
        barcode: barcode.trim() || undefined,
        photoDataUrl,
        notes: finalNotes,
      },
      editingBottle?.id,
    );
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4">
        <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-cellar-700 bg-cellar-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-cellar-700/80 px-4 py-3.5 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2.5">
              <Wine className="h-5 w-5 text-gold-400" />
              <h2 className="font-serif text-xl font-semibold text-stone-100">
                {editingBottle ? 'Modifier la bouteille' : 'Ajouter une bouteille'}
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

          <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {error && (
              <div className="rounded-xl border border-red-700/60 bg-red-950/60 px-4 py-2.5 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Code-barres : remplissage automatique */}
            <div className="rounded-xl border border-cellar-700/70 bg-cellar-950/60 p-3.5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gold-400">
                Code-barres (EAN / UPC) — Remplissage automatique
              </label>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <input
                    type="text"
                    maxLength={40}
                    value={barcode}
                    onChange={(e) => handleBarcodeInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleBarcodeLookup(barcode, true);
                      }
                    }}
                    placeholder="Saisir, coller ou scanner un code-barres..."
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-900 py-2 pl-9 pr-3 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={isLookingUpBarcode || !barcode.trim()}
                  onClick={() => void handleBarcodeLookup(barcode, true)}
                  className="flex items-center gap-1.5 rounded-xl border border-cellar-700 bg-cellar-850 px-3 py-2 text-xs font-medium text-stone-100 transition hover:border-bordeaux-500 hover:bg-cellar-800 disabled:opacity-50"
                >
                  {isLookingUpBarcode ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gold-400" />
                  ) : (
                    <Search className="h-4 w-4 text-gold-400" />
                  )}
                  Rechercher
                </button>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-cellar-700 bg-cellar-850 px-3 py-2 text-xs font-medium text-gold-400 transition hover:border-gold-500/50 hover:bg-cellar-800"
                  title="Scanner avec la caméra"
                >
                  <Camera className="h-4 w-4" />
                  Scanner
                </button>
              </div>
              {barcodeFeedback && (
                <p
                  className={`mt-2 text-xs ${
                    barcodeFeedback.type === 'success'
                      ? 'text-emerald-300'
                      : barcodeFeedback.type === 'error'
                        ? 'text-red-300'
                        : 'text-amber-300'
                  }`}
                >
                  {barcodeFeedback.text}
                </p>
              )}
            </div>

            {/* Photo + Identité principale */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[140px_1fr]">
              <div className="flex flex-col items-center gap-2">
                <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-cellar-700 bg-cellar-950">
                  {photoDataUrl ? (
                    <>
                      <img
                        src={photoDataUrl}
                        alt="Étiquette"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotoDataUrl(undefined)}
                        className="absolute right-1.5 top-1.5 rounded-lg bg-black/75 p-1.5 text-rose-300 transition hover:bg-rose-900 hover:text-white"
                        title="Supprimer la photo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center px-2 text-center text-stone-500">
                      <ImagePlus className="mb-1.5 h-7 w-7 text-stone-500" />
                      <span className="text-[11px]">
                        {isCompressing ? 'Compression...' : 'Photo étiquette'}
                      </span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isCompressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg border border-cellar-700 bg-cellar-850 px-2.5 py-1.5 text-xs font-medium text-stone-200 transition hover:border-bordeaux-500 hover:bg-cellar-800 disabled:opacity-50"
                >
                  {photoDataUrl ? 'Changer la photo' : 'Ajouter / Capturer'}
                </button>
                {photoDataUrl && (
                  <button
                    type="button"
                    disabled={isIdentifyingLabel}
                    onClick={() => void handleIdentifyLabel()}
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-gold-500/40 bg-bordeaux-700/60 px-2 py-1.5 text-[11px] font-medium text-gold-300 transition hover:bg-bordeaux-600/70 disabled:opacity-50"
                    title="Reconnaissance automatique de l'étiquette via Gemini Vision"
                  >
                    {isIdentifyingLabel ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {isIdentifyingLabel ? 'Analyse...' : 'Lire étiquette'}
                  </button>
                )}
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                    Nom / Domaine / Cuvée *
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Château Margaux, Domaine Tempier..."
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                      Cave *
                    </label>
                    <select
                      value={cellarId}
                      onChange={(e) => setCellarId(e.target.value)}
                      className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3 py-2.5 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                      required
                    >
                      {cellars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                      Couleur *
                    </label>
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value as WineColor)}
                      className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3 py-2.5 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                    >
                      {(Object.keys(WINE_COLOR_LABELS) as WineColor[]).map((key) => (
                        <option key={key} value={key}>
                          {WINE_COLOR_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                      Appellation / Région
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={appellation}
                      onChange={(e) => setAppellation(e.target.value)}
                      placeholder="Ex: Pauillac, Chablis, Champagne..."
                      className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                      Millésime
                    </label>
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      value={vintage}
                      onChange={(e) => setVintage(e.target.value)}
                      placeholder="Ex: 2019"
                      className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stock, Emplacement, Prix */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                  Quantité *
                </label>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 focus:border-bordeaux-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                  Emplacement
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={rackLocation}
                  onChange={(e) => setRackLocation(e.target.value)}
                  placeholder="Ex: Casier B3"
                  className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                  Prix d'achat (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={999999}
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="Ex: 35.50"
                  className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                  Cote estimée (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={999999}
                  value={estimatedCurrentPrice}
                  onChange={(e) => setEstimatedCurrentPrice(e.target.value)}
                  placeholder="Auto par IA"
                  className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Fenêtre de dégustation */}
            <div className="rounded-xl border border-cellar-700/70 bg-cellar-950/60 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
                  Fenêtre de dégustation (« quand boire »)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowApiKeyInput((v) => !v)}
                    className="flex items-center gap-1 rounded-lg border border-cellar-700 bg-cellar-900 px-2.5 py-1 text-[11px] font-medium text-stone-300 transition hover:border-gold-500/40 hover:text-white"
                    title="Configurer une clé API Gemini (optionnel)"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-gold-400" />
                    {hasGeminiApiKey() ? 'Gemini actif' : 'Clé Gemini'}
                  </button>
                  <button
                    type="button"
                    disabled={isEstimatingAi}
                    onClick={() => void handleEstimateWithAi()}
                    className="flex items-center gap-1.5 rounded-lg border border-gold-500/40 bg-bordeaux-700/60 px-3 py-1 text-xs font-medium text-gold-300 transition hover:bg-bordeaux-600/70 disabled:opacity-50"
                  >
                    {isEstimatingAi ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {isEstimatingAi ? 'Estimation...' : 'Remplir par IA'}
                  </button>
                </div>
              </div>

              {showApiKeyInput && (
                <div className="mb-3 rounded-lg border border-cellar-700 bg-cellar-900/90 p-3">
                  <p className="mb-1.5 text-[11px] text-stone-300">
                    Optionnel : ajoutez une clé API Google Gemini pour des estimations IA sur mesure (sinon le mode œnologique local est utilisé).
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="password"
                      maxLength={120}
                      value={apiKeyDraft}
                      onChange={(e) => setApiKeyDraft(e.target.value)}
                      placeholder="AIza..."
                      className="min-w-0 flex-1 rounded-lg border border-cellar-700 bg-cellar-950 px-3 py-1.5 text-xs text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveApiKey}
                      className="rounded-lg bg-bordeaux-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-bordeaux-500"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-stone-400">
                    Début d'apogée (année)
                  </label>
                  <input
                    type="number"
                    min={1950}
                    max={2150}
                    value={drinkFrom}
                    onChange={(e) => setDrinkFrom(e.target.value)}
                    placeholder="Auto par IA"
                    className="w-full rounded-lg border border-cellar-700 bg-cellar-900 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-400">
                    Fin d'apogée (année)
                  </label>
                  <input
                    type="number"
                    min={1950}
                    max={2150}
                    value={drinkTo}
                    onChange={(e) => setDrinkTo(e.target.value)}
                    placeholder="Auto par IA"
                    className="w-full rounded-lg border border-cellar-700 bg-cellar-900 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-400">
                    Conservation max (ans)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxKeepYears}
                    onChange={(e) => setMaxKeepYears(e.target.value)}
                    placeholder="Auto par IA"
                    className="w-full rounded-lg border border-cellar-700 bg-cellar-900 px-3 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                  />
                </div>
              </div>
              {aiFeedback ? (
                <p className="mt-2.5 text-xs text-gold-300/90">{aiFeedback}</p>
              ) : (
                !editingBottle && (
                  <p className="mt-2.5 text-[11px] text-stone-400">
                    Laissez vide pour un remplissage automatique à l'ajout, ou cliquez sur « Remplir par IA ».
                  </p>
                )
              )}
            </div>

            {/* Accords mets-vins & Notes */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                  Accords mets-vins (séparés par des virgules)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={foodPairingsText}
                  onChange={(e) => setFoodPairingsText(e.target.value)}
                  placeholder="Ex: Côte de bœuf, Magret de canard, Comté affiné"
                  className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-400">
                  Notes de dégustation / service
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Carafer 1h avant... (rempli par l'IA si laissé vide)"
                  className="w-full rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-cellar-700/70 pt-4 sm:flex-row sm:justify-end sm:gap-3">
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
                {editingBottle ? 'Enregistrer' : 'Ajouter à la cave'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setBarcode(code);
          void handleBarcodeLookup(code, true);
        }}
      />
    </>
  );
};
