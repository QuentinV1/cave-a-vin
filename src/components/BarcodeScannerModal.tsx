import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertTriangle } from 'lucide-react';

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;

    const startScanner = async () => {
      setError(null);
      const BarcodeDetectorCtor = (
        window as unknown as {
          BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
        }
      ).BarcodeDetector;

      if (!BarcodeDetectorCtor) {
        setError(
          "L'API BarcodeDetector n'est pas prise en charge par ce navigateur. Saisissez le code-barres manuellement ci-dessous.",
        );
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("L'accès à la caméra n'est pas disponible sur cet appareil.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetectorCtor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
        });

        const scanFrame = async () => {
          if (!active || !videoRef.current) return;
          if (videoRef.current.readyState >= 2) {
            try {
              const results = await detector.detect(videoRef.current);
              const found = results.find((r) => r.rawValue && r.rawValue.trim().length > 0);
              if (found?.rawValue) {
                onDetected(found.rawValue.trim());
                onClose();
                return;
              }
            } catch {
              // Ignore transient frame detection errors
            }
          }
          rafId = requestAnimationFrame(scanFrame);
        };

        rafId = requestAnimationFrame(scanFrame);
      } catch {
        if (active) {
          setError(
            "Impossible d'accéder à la caméra. Vérifiez les permissions ou saisissez le code-barres manuellement.",
          );
        }
      }
    };

    startScanner();

    return () => {
      active = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, onClose, onDetected]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    onDetected(trimmed);
    setManualCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-cellar-700 bg-cellar-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-cellar-700/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Camera className="h-5 w-5 text-gold-400" />
            <h3 className="font-serif text-lg font-semibold text-stone-100">
              Scanner un code-barres
            </h3>
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

        <div className="space-y-4 p-5">
          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-700/50 bg-amber-950/40 p-3.5 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-cellar-700 bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full object-cover"
                playsInline
                muted
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-3/4 rounded-lg border-2 border-gold-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              <p className="bg-black/70 px-3 py-1.5 text-center text-xs text-stone-300">
                Placez le code-barres de la bouteille dans le cadre
              </p>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-stone-400">
              Ou saisie manuelle
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={40}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: 3760123456789"
                className="min-w-0 flex-1 rounded-xl border border-cellar-700 bg-cellar-950 px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-bordeaux-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-bordeaux-500"
              >
                Valider
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
