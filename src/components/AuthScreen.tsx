import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import {
  connexionEmail,
  connexionGoogle,
  db,
  formatAuthError,
  inscriptionEmail,
  reinitialiserMotDePasse,
} from '../utils/firebase';
import { CloudState } from '../utils/firestoreStorage';
import { resolveUserAccess, type AccessStatus } from '../utils/accessControl';
import { AccessControlPanel } from './AccessControlPanel';

export interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  cloudState: CloudState;
  itemSummaryLabel: string;
  onForceSync: () => Promise<void>;
  onRestartSync: () => void;
  onSignOut: () => Promise<void>;
  onUserReloaded: (user: User | null) => void;
}

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({
  isOpen,
  onClose,
  user,
  cloudState,
  itemSummaryLabel,
  onForceSync,
  onRestartSync: _onRestartSync,
  onSignOut,
  onUserReloaded: _onUserReloaded,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [syncBusy, setSyncBusy] = useState(false);
  const [localSyncError, setLocalSyncError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'access'>('account');
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    if (!isOpen || !user?.email) {
      setAccessStatus(null);
      setActiveTab('account');
      return;
    }
    let cancelled = false;
    resolveUserAccess(db, 'cave-a-vin', user.email)
      .then((status) => {
        if (!cancelled) {
          setAccessStatus(status);
          if (!status.isAdmin) setActiveTab('account');
        }
      })
      .catch(() => {
        if (!cancelled) setAccessStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.email]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInfo(null);
    setLocalSyncError(null);
  }, [isOpen, user?.uid]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEmailAuth = async (isRegister: boolean) => {
    setError(null);
    setInfo(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Veuillez saisir votre adresse e-mail.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await inscriptionEmail(trimmedEmail, password);
      } else {
        await connexionEmail(trimmedEmail, password);
        onClose();
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await connexionGoogle();
      onClose();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Saisissez votre adresse e-mail pour recevoir le lien de réinitialisation.');
      return;
    }
    setLoading(true);
    try {
      await reinitialiserMotDePasse(email.trim());
      setInfo('E-mail de réinitialisation envoyé. Vérifiez votre boîte de réception.');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    setSyncBusy(true);
    setLocalSyncError(null);
    try {
      await onForceSync();
    } catch (err) {
      setLocalSyncError(
        err instanceof Error ? err.message : 'Impossible de synchroniser.',
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const renderSyncStatus = () => {
    if (cloudState.syncStatus === 'syncing' || syncBusy) {
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Synchronisation en cours…
        </span>
      );
    }
    if (cloudState.syncStatus === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Erreur de synchronisation
        </span>
      );
    }
    if (cloudState.initialSyncDone || cloudState.syncStatus === 'synced') {
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Synchronisé ({itemSummaryLabel})
        </span>
      );
    }
    return <span className="text-stone-400">Connexion au Cloud…</span>;
  };

  const displayedSyncError = localSyncError || cloudState.syncError;

  return (
    <div
      id="modal-auth"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-cellar-700 bg-cellar-900 p-4 text-stone-100 shadow-2xl sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-cellar-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Cloud className="h-5 w-5 text-gold-400" />
            <h2 className="font-serif text-lg font-bold text-stone-100">
              Compte Cloud La Cave
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-cellar-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user ? (
          /* Panneau déconnecté */
          <div id="auth-logged-out-panel">
            <p className="mb-4 text-xs leading-relaxed text-stone-400">
              L&apos;application fonctionne hors-ligne en local. Connectez-vous pour
              synchroniser vos caves, bouteilles, relevés et dégustations entre tous
              vos appareils.
            </p>

            {error && (
              <div
                id="auth-error-msg"
                className="mb-3 rounded-xl border border-red-700/60 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-200"
              >
                {error}
              </div>
            )}
            {info && (
              <div className="mb-3 rounded-xl border border-emerald-700/60 bg-emerald-950/50 px-3.5 py-2.5 text-xs text-emerald-200">
                {info}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1 block text-xs font-medium text-stone-300"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom@exemple.fr"
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-950 py-2.5 pl-9 pr-3 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-stone-300"
                  >
                    Mot de passe (6 car. min)
                  </label>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="text-[11px] text-gold-400 hover:text-gold-300 disabled:opacity-50"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleEmailAuth(false);
                      }
                    }}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-cellar-700 bg-cellar-950 py-2.5 pl-9 pr-3 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleEmailAuth(false)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-bordeaux-900/50 transition hover:bg-bordeaux-500 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Se connecter
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleEmailAuth(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cellar-700 bg-cellar-950 px-4 py-2.5 text-sm font-medium text-stone-200 transition hover:border-bordeaux-500 hover:bg-cellar-800 disabled:opacity-60"
                >
                  Créer un compte
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleGoogleLogin()}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-cellar-700 bg-cellar-950 px-4 py-2.5 text-sm font-medium text-stone-100 transition hover:border-stone-500 hover:bg-cellar-800/70 disabled:opacity-60"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  Continuer avec Google
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Panneau compte connecté */
          <div id="auth-logged-in-panel" className="space-y-3.5">
            {accessStatus?.isAdmin && (
              <div className="flex gap-1.5 rounded-xl border border-cellar-800 bg-cellar-950 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('account')}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === 'account'
                      ? 'bg-cellar-800 text-stone-100 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Compte Cloud
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('access')}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === 'access'
                      ? 'bg-cellar-800 text-sky-400 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Accès &amp; Rôles
                </button>
              </div>
            )}

            {accessStatus && !accessStatus.hasAppAccess && (
              <div className="rounded-xl border border-red-700/60 bg-red-950/60 px-3.5 py-2.5 text-xs font-medium text-red-200">
                Votre compte n&apos;est pas autorisé sur cette application. Contactez un administrateur.
              </div>
            )}

            {activeTab === 'access' && accessStatus?.isAdmin ? (
              <AccessControlPanel
                db={db}
                user={user}
                appId="cave-a-vin"
                appName="La Cave"
                theme="dark"
              />
            ) : (
              <>
            <div className="rounded-xl border border-cellar-800 bg-cellar-950/80 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Connecté en tant que
              </div>
              <div
                id="auth-connected-email"
                className="mt-1 break-all text-sm font-bold text-stone-100"
              >
                {user.email || user.displayName || user.uid}
              </div>
              <div id="auth-sync-status" className="mt-2 text-xs font-medium">
                {renderSyncStatus()}
              </div>
            </div>

            {displayedSyncError && (
              <div
                id="auth-sync-error-msg"
                className="rounded-xl border border-red-700/60 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-200"
              >
                {displayedSyncError}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                id="btn-force-sync"
                disabled={syncBusy || cloudState.syncStatus === 'syncing'}
                onClick={() => void handleForceSync()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-bordeaux-900/50 transition hover:bg-bordeaux-500 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    syncBusy || cloudState.syncStatus === 'syncing'
                      ? 'animate-spin'
                      : ''
                  }`}
                />
                Synchroniser maintenant
              </button>

              <button
                type="button"
                onClick={() => void onSignOut()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-900/60"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </button>
            </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const AuthScreen = CloudAuthModal;
