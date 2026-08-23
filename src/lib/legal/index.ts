export * from './types';
export * from './company';
export { CURRENT_LEGAL_VERSIONS, LEGAL_VERSIONS_HISTORY, computeDocsEnAttente } from './versions';
export { KNOWN_PROCESSORS, activeProcessors, type DataProcessor } from './processors';

export { buildMentionsLegales } from './content/mentions-legales';
export { buildCGU } from './content/cgu';
export { buildCGV } from './content/cgv';
export { buildPolitiqueConfidentialite } from './content/politique-confidentialite';

export { default as LegalPage, type LegalPageProps } from './components/LegalPage';
export { default as CookieConsentBanner, type CookieConsentBannerProps } from './components/CookieConsentBanner';
export { default as AIDisclosure, type AIDisclosureProps } from './components/AIDisclosure';
export { default as LegalAcceptanceNotice, type LegalAcceptanceNoticeProps } from './components/LegalAcceptanceNotice';
export { default as LegalReacceptanceGate, type LegalReacceptanceGateProps } from './components/LegalReacceptanceGate';
export { default as MaMemoirePage, type MaMemoirePageProps, type LegalAcceptanceRow } from './components/MaMemoirePage';
export { default as AccountDeletionButton, type AccountDeletionButtonProps } from './components/AccountDeletionButton';

export { useCookieConsent, type CookieConsent } from './hooks/useCookieConsent';
