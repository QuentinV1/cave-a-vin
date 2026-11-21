import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  Auth,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

export const FIREBASE_CONFIG = {
  apiKey:
    (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ||
    'AIzaSyCuYM0tMpd1f1jDYz27OhCaPpcAWhI3i48',
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ||
    'quentin-apps-hub.firebaseapp.com',
  projectId:
    (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
    'quentin-apps-hub',
  storageBucket:
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ||
    'quentin-apps-hub.firebasestorage.app',
  messagingSenderId:
    (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ||
    '249016348389',
  appId:
    (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ||
    '1:249016348389:web:eda76b5047fca24d9cee0c',
};

const isFileProtocol =
  typeof window !== 'undefined' && window.location?.protocol === 'file:';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let currentUser: User | null = null;

if (!isFileProtocol) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);

    const appCheckSiteKey =
      (import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined) ||
      '6LfRaysuAAAAACpC4hKbGG5Bjpr3Ifr1CyUSlmRe';
    if (appCheckSiteKey && typeof window !== 'undefined') {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }

    auth = getAuth(app);

    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        ignoreUndefinedProperties: true,
      });
    } catch {
      // Déjà initialisé (HMR) ou cache IndexedDB indisponible (ex. navigation privée / tests)
      db = getFirestore(app);
    }

    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.warn('Firebase SDK indisponible (mode hors-ligne local):', err);
    app = null;
    auth = null;
    db = null;
    googleProvider = null;
  }
}

export const isFirebaseConfigured = Boolean(app && auth && db);

export function getFirebaseUser(): User | null {
  return currentUser ?? auth?.currentUser ?? null;
}

export function estConnecteFirebase(): boolean {
  return Boolean(getFirebaseUser());
}

export function observerAuth(onUserChanged: (user: User | null) => void): () => void {
  if (!auth) {
    currentUser = null;
    onUserChanged(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
    onUserChanged(currentUser);
  });
}

export async function connexionEmail(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase indisponible hors-ligne.');
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  currentUser = cred.user;
  return cred.user;
}

export async function inscriptionEmail(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase indisponible hors-ligne.');
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  currentUser = cred.user;
  if (cred.user) {
    sendEmailVerification(cred.user).catch(() => {});
  }
  return cred.user;
}

export async function connexionGoogle(): Promise<User> {
  if (!auth || !googleProvider) throw new Error('Firebase indisponible hors-ligne.');
  const cred = await signInWithPopup(auth, googleProvider);
  currentUser = cred.user;
  return cred.user;
}

export async function renvoyerEmailVerification(): Promise<boolean> {
  if (!auth || !auth.currentUser) throw new Error('Aucun utilisateur connecté.');
  if (auth.currentUser.emailVerified) return false;
  await sendEmailVerification(auth.currentUser);
  return true;
}

export async function rechargerUtilisateurFirebase(): Promise<User | null> {
  if (!auth || !auth.currentUser) return null;
  await auth.currentUser.reload();
  currentUser = auth.currentUser;
  if (currentUser.emailVerified) {
    await currentUser.getIdToken(true);
  }
  return currentUser;
}

export async function reinitialiserMotDePasse(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase indisponible hors-ligne.');
  await sendPasswordResetEmail(auth, email.trim());
}

export async function deconnexionFirebase(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
  currentUser = null;
}

export function formatAuthError(err: unknown): string {
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
      return 'Domaine non autorisé dans Firebase Auth.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez réessayer dans quelques minutes.';
    case 'permission-denied':
      return 'Accès Firestore refusé (vérifiez que votre e-mail est bien vérifié et autorisé).';
    default:
      return err instanceof Error ? err.message : 'Erreur lors de la connexion.';
  }
}

export { app, auth, db, googleProvider };
