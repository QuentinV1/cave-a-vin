import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Camera,
  LayoutGrid,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserPlus,
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
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

  const highlights = [
    {
      icon: Camera,
      title: 'Scan d’étiquette & Code-barres',
      desc: 'Ajoute tes bouteilles par photo IA ou scan en quelques secondes.',
    },
    {
      icon: LayoutGrid,
      title: 'Casiers visuels & Apogée',
      desc: 'Visualise tes emplacements et anticipe les fenêtres de dégustation.',
    },
    {
      icon: Sparkles,
      title: 'Accords & Dégustations',
      desc: 'Garde l’historique de tes notes, accords mets-vins et valorisation.',
    },
  ];

  return (
    <div
      id="access-gate-wall"
      className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-100 via-rose-50/40 to-slate-100 p-4 sm:p-6"
    >
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl lg:grid-cols-12">
        {/* Panneau éditorial */}
        <div className="relative flex flex-col justify-between bg-gradient-to-br from-stone-950 via-rose-950 to-rose-900 p-7 text-white lg:col-span-6 lg:p-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <Wine className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xl font-extrabold tracking-tight">La Cave</p>
                <p className="text-xs text-rose-100/80">Suivi de stock &amp; dégustation</p>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                Gère tes bouteilles, casiers et dégustations.
              </h1>
              <p className="text-sm text-rose-100/80">
                Synchronisé en temps réel sur tous tes appareils et accessible hors-ligne au fond de la cave.
              </p>
            </div>

            <div className="hidden space-y-3 pt-2 lg:block">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10 backdrop-blur-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-4 w-4 text-rose-100" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-rose-100/80">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 hidden items-center gap-2 text-xs text-rose-100/70 lg:flex">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Mode PWA hors-ligne inclus</span>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-6 lg:p-10">
          {gate.phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-rose-800" />
              <p className="text-sm text-slate-600">
                Vérification de votre session et de vos autorisations…
              </p>
            </div>
          )}

          {gate.phase === 'unauthenticated' && (
            <div id="access-gate-login">
              <div className="mb-6 space-y-1">
                <h2 className="text-xl font-bold text-slate-900">
                  {mode === 'login' ? 'Connexion à ton espace' : 'Créer ton compte'}
                </h2>
                <p className="text-sm text-slate-500">
                  Utilise ton compte autorisé pour retrouver ta cave personnelle synchronisée.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleGoogleLogin()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-950 disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4" />
                  Continuer avec Google
                </button>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>ou par e-mail</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleEmailAuth(mode === 'register');
                  }}
                  className="space-y-3"
                >
                  <input
                    id="gate-auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="adresse@email.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-800 focus:ring-2 focus:ring-rose-100"
                  />

                  <div className="space-y-1.5">
                    <input
                      id="gate-auth-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mot de passe (6+ caractères)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-800 focus:ring-2 focus:ring-rose-100"
                    />
                    {mode === 'login' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleResetPassword()}
                          disabled={loading}
                          className="text-[11px] font-medium text-rose-800 hover:underline disabled:opacity-50"
                        >
                          Mot de passe oublié ?
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mode === 'register' ? (
                      <UserPlus className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {mode === 'register' ? 'Créer un compte' : 'Se connecter par e-mail'}
                  </button>
                </form>

                <button
                  type="button"
                  className="w-full cursor-pointer pt-1 text-center text-xs font-medium text-slate-500 hover:text-rose-800"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError(null);
                    setInfo(null);
                  }}
                >
                  {mode === 'login'
                    ? 'Pas encore de compte ? Créer un compte'
                    : 'Déjà inscrit ? Se connecter'}
                </button>

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
                    {error}
                  </p>
                )}
                {info && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-800">
                    {info}
                  </p>
                )}
              </div>
            </div>
          )}

          {gate.phase === 'unauthorized' && (
            <div id="access-gate-unauthorized" className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-red-950">Accès non autorisé</div>
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter / Changer de compte
              </button>
            </div>
          )}

          {gate.phase === 'offline_unverified' && (
            <div id="access-gate-offline" className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-amber-950">
                    Connexion Internet requise pour vérifier vos autorisations
                  </div>
                  <p className="leading-relaxed">
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-950 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleSignOutClick()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter / Changer de compte
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
