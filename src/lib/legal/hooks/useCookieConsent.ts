'use client';

import { useCallback, useSyncExternalStore } from 'react';

export interface CookieConsent {
  necessaire: true;
  mesure: boolean;
  marketing: boolean;
  updatedAt: string;
}

const STORAGE_KEY = 'purama_cookie_consent_v1';

function readStoredConsent(): CookieConsent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

/** `undefined` = pas encore hydraté côté client (valeur retournée par getServerSnapshot). */
let cachedSnapshot: CookieConsent | null | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): CookieConsent | null | undefined {
  if (cachedSnapshot === undefined) cachedSnapshot = readStoredConsent();
  return cachedSnapshot;
}

function getServerSnapshot(): CookieConsent | null | undefined {
  return undefined;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedSnapshot = readStoredConsent();
      onStoreChange();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStorage);
  };
}

function writeConsent(next: CookieConsent) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedSnapshot = next;
  listeners.forEach((l) => l());
}

/**
 * Consentement cookies fonctionnel (RGPD/ePrivacy) : persisté en localStorage (fonctionne
 * pour un visiteur anonyme, avant toute connexion) et, si `onConsent` est fourni par l'app,
 * synchronisé en base via `POST /api/legal/cookie-consent` (cf `api/cookie-consent.ts`) une
 * fois l'utilisateur authentifié — pour garder une preuve du consentement indépendante du
 * navigateur de l'utilisateur.
 *
 * Implémenté via `useSyncExternalStore` (pas un `useEffect` + `setState`, qui déclenche la
 * règle React Compiler `set-state-in-effect`) : `getServerSnapshot` renvoie `undefined`
 * (non hydraté), identique entre le rendu serveur et la première passe client, puis React
 * re-rend automatiquement avec la vraie valeur localStorage sans cascade de renders.
 */
export function useCookieConsent(onConsent?: (consent: CookieConsent) => void) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = snapshot !== undefined;
  const consent = hydrated ? snapshot : null;

  const save = useCallback(
    (mesure: boolean, marketing: boolean) => {
      const next: CookieConsent = { necessaire: true, mesure, marketing, updatedAt: new Date().toISOString() };
      writeConsent(next);
      onConsent?.(next);
    },
    [onConsent]
  );

  const acceptAll = useCallback(() => save(true, true), [save]);
  const refuseAll = useCallback(() => save(false, false), [save]);

  return {
    /** null tant que la préférence n'est pas connue OU pas encore hydratée côté client. */
    consent,
    /** true une fois le rendu client effectué — évite un flash SSR/CSR incohérent. */
    hydrated,
    /** true si le bandeau doit être affiché (aucun choix enregistré). */
    needsChoice: hydrated && consent === null,
    acceptAll,
    refuseAll,
    save,
  };
}
