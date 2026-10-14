// Synthetic request/response fixtures only; no provider is contacted.
export const generationErrorCases = {
  waiting: { error: 'SUTRA_LOCAL_NOT_CONFIGURED', title: 'Mode personnel distant indisponible' },
  quota: { error: 'Credits insuffisants', title: 'Limite du compte ou budget atteint' },
  'worker-budget': { error: 'SALAD_ESTIMATE_EXCEEDS_BUDGET', title: 'Limite du compte ou budget atteint' },
  'worker-profile': { error: 'SALAD_UNSUPPORTED_PROFILE', title: 'Format non pris en charge par le mode personnel' },
  unknown: { error: `Failed to fetch fixture-provider-details-${'x'.repeat(2000)}`, title: 'Résultat de la génération non confirmé' },
}
export const socialAccounts = [
  ['youtube', 'connected'], ['instagram', 'revoked'], ['facebook', 'expired'],
  ['x', 'error'], ['tiktok', 'disconnected'], ['linkedin', 'unknown'],
].map(([platform, status], i) => ({ id: `fixture-account-${i}`, platform, status, username: `historique_${platform}`, display_name: 'Compte fixture', avatar_url: null, connected_at: '2026-10-01T00:00:00Z' }))
