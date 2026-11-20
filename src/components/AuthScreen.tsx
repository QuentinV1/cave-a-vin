import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { AlertTriangle, KeyRound, Loader2, Mail, Wine } from 'lucide-react';
import { auth, googleProvider, isFirebaseConfigured } from '../utils/firebase';

function mapAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou mot de passe incorrect.';
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cette adresse e-mail.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/popup-closed-by-user':
      return 'La fenêtre de connexion Google a été fermée.';
    case 'auth/popup-blocked':
      return 'La fenêtre pop-up a été bloquée par votre navigateur.';
    case 'auth/unauthorized-domain':
      return 'Domaine non autorisé dans Firebase Auth (ajoutez ce domaine dans Authentication > Settings > Authorized domains).';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez réessayer dans quelques minutes.';
    default:
      return err instanceof Error ? err.message : 'Erreur lors de la connexion.';
  }
}

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isFirebaseConfigured || !auth || !googleProvider) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#2a1019_0%,_#11070a_45%,_#0b0507_100%)] px-4 text-stone-100">
        <div className="w-full max-w-lg rounded-2xl border border-amber-700/60 bg-cellar-900/90 p-6 shadow-2xl">
          <div className="flex items-center gap-3 text-amber-300">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h1 className="font-serif text-xl font-bold text-stone-100">
              Configuration Firebase requise
            </h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">
            Les variables d&apos;environnement Firebase ne sont pas encore configurées.
          </p>
          <ol className="mt-3 list-inside list-decimal space-y-1.5 text-xs text-stone-400">
            <li>
              Copiez <code className="rounded bg-cellar-950 px-1.5 py-0.5 text-stone-200">.env.example</code> vers{' '}
              <code className="rounded bg-cellar-950 px-1.5 py-0.5 text-stone-200">.env.local</code>.
            </li>
            <li>
              Renseignez vos clés Firebase (<code className="text-stone-300">VITE_FIREBASE_*</code>) depuis la console Firebase.
            </li>
            <li>
              Activez <strong>Email/Mot de passe</strong> et <strong>Google</strong> dans Authentication, créez la base Cloud Firestore et déployez{' '}
              <code className="text-stone-300">firestore.rules</code>.
            </li>
          </ol>
        </div>
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    setInfo(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!auth) return;
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Saisissez votre adresse e-mail pour recevoir le lien de réinitialisation.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('E-mail de réinitialisation envoyé. Vérifiez votre boîte de réception.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#2a1019_0%,_#11070a_45%,_#0b0507_100%)] px-4 py-8 text-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-cellar-800 bg-cellar-900/90 p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-gold-500/30 bg-gradient-to-br from-bordeaux-600 to-bordeaux-800 shadow-lg shadow-bordeaux-900/50">
            <Wine className="h-6 w-6 text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-100">La Cave</h1>
          <p className="mt-1 text-xs text-stone-400">
            Connectez-vous pour retrouver votre cave sur tous vos appareils
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-5 grid grid-cols-2 rounded-xl border border-cellar-800 bg-cellar-950/70 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setInfo(null);
            }}
            className={`rounded-lg py-2 font-medium transition ${
              mode === 'login'
                ? 'bg-bordeaux-600 text-white shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setInfo(null);
            }}
            className={`rounded-lg py-2 font-medium transition ${
              mode === 'register'
                ? 'bg-bordeaux-600 text-white shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Créer un compte
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-700/60 bg-red-950/60 px-3.5 py-2.5 text-xs text-red-200">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 rounded-xl border border-emerald-700/60 bg-emerald-950/50 px-3.5 py-2.5 text-xs text-emerald-200">
            {info}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-300">
              Adresse e-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 py-2.5 pl-9 pr-3 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-300">
              Mot de passe
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-cellar-700 bg-cellar-950 py-2.5 pl-9 pr-3 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-300">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-cellar-700 bg-cellar-950 py-2.5 pl-9 pr-3 text-sm text-stone-100 placeholder-stone-500 focus:border-bordeaux-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={loading}
                className="text-xs text-gold-400 hover:text-gold-300 disabled:opacity-50"
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bordeaux-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-bordeaux-900/50 transition hover:bg-bordeaux-500 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-stone-500">
          <div className="h-px flex-1 bg-cellar-800" />
          <span>ou</span>
          <div className="h-px flex-1 bg-cellar-800" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-cellar-700 bg-cellar-950 px-4 py-2.5 text-sm font-medium text-stone-100 transition hover:border-stone-500 hover:bg-cellar-800/70 disabled:opacity-60"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
            />
          </svg>
          Continuer avec Google
        </button>
      </div>
    </div>
  );
};
