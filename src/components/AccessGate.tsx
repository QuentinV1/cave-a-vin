import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  Wine,
} from 'lucide-react';
import {
  connexionEmail,
  connexionGoogle,
  formatAuthError,
  inscriptionEmail,
  reinitialiserMotDePasse,
} from '../utils/firebase';
import type { AccessStatus } from '../utils/accessControl';

export type AccessGateState =
  | { phase: 'loading' }
  | { phase: 'unauthenticated' }
  | { phase: 'authorized'; status: AccessStatus; offline: boolean }
  | { phase: 'unauthorized'; email: string }
  | { phase: 'offline_unverified'; email: string };

interface AccessGateProps {
  gate: AccessGateState;
  user: User | null;
  onRetryVerification: () => void;
  onSignOut: () => Promise<void>;
}

export const AccessGate: React.FC<AccessGateProps> = ({
  gate,
  user,
  onRetryVerification,
  onSignOut,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (gate.phase === 'authorized') return null;

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

  const handleSignOutClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSignOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="access-gate-wall"
      className="fixed inset-0 z-50 flex items-center justify-center bg-cellar-950 p-4 text-stone-100"
    >
      <div className="w-full max-w-md rounded-2xl border border-cellar-700 bg-cellar-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3 border-b border-cellar-800 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bordeaux-900/60 text-gold-400">
            <Wine className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-stone-100">La Cave</h1>
            <p className="text-xs text-stone-400">Accès sécurisé &amp; Synchronisation</p>
          </div>
        </div>

        {gate.phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            <p className="text-sm text-stone-300">
              Vérification de votre session et de vos autorisations…
            </p>
          </div>
        )}

        {gate.phase === 'unauthenticated' && (
          <div id="access-gate-login">
            <p className="mb-4 text-xs leading-relaxed text-stone-400">
              Connexion requise pour accéder à votre cave. Connectez-vous une première
              fois en ligne pour activer l&apos;utilisation hors-ligne en cave.
            </p>

            {error && (
              <div className="mb-3 rounded-xl border border-red-700/60 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-200">
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
                  htmlFor="gate-auth-email"
                  className="mb-1 block text-xs font-medium text-stone-300"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <input
                    id="gate-auth-email"
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
                    htmlFor="gate-auth-password"
                    className="block text-xs font-medium text-stone-300"
                  >
                    Mot de passe (6 car. min)
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleResetPassword()}
                    disabled={loading}
                    className="text-[11px] text-gold-400 hover:text-gold-300 disabled:opacity-50"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                  <input
                    id="gate-auth-password"
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
        )}

        {gate.phase === 'unauthorized' && (
          <div id="access-gate-unauthorized" className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-700/60 bg-red-950/60 p-4 text-xs text-red-200">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div className="space-y-1">
                <div className="text-sm font-bold text-red-100">Accès non autorisé</div>
                <p className="leading-relaxed">
                  Le compte <strong className="break-all">{user?.email || gate.email}</strong>{' '}
                  n&apos;est pas autorisé sur cette application. Contactez un administrateur.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSignOutClick()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-900/60 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter / Changer de compte
            </button>
          </div>
        )}

        {gate.phase === 'offline_unverified' && (
          <div id="access-gate-offline" className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-600/40 bg-amber-950/40 p-4 text-xs text-amber-100">
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="space-y-1">
                <div className="text-sm font-bold text-amber-200">
                  Connexion Internet requise pour vérifier vos autorisations
                </div>
                <p className="leading-relaxed text-stone-300">
                  Aucune autorisation hors-ligne valide n&apos;a été trouvée pour{' '}
                  <strong className="break-all">{user?.email || gate.email}</strong>.
                  Connectez-vous à Internet pour valider votre accès.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={onRetryVerification}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bordeaux-500 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSignOutClick()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-900/60 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter / Changer de compte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
