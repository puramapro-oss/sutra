// Public DTO contract supplied by T04; synthetic data only.
const publicCapabilities = (state, allowed = true) => ({
  version: 1, personal: { allowed, provider: 'salad', state, available: allowed && state === 'ready', reason: state === 'ready' ? null : 'fixture-private-reason-never-display', operations: [], profiles: [], quotaRemaining: null, cost: { estimatedComputeUsd: state === 'ready' ? 0.125 : null, actualUsd: null, currency: 'USD', basis: 'compute-only-excludes-idle-storage-network' } },
  client: { mode: 'api', availability: 'unknown', reason: 'PROVIDER_NOT_PROBED' },
})
const unknown = 'Mode personnel distant : disponibilité non vérifiée sur cet écran.'
export const capabilitiesCases = [
      ['client', { body: publicCapabilities('unavailable', false) }, 'Compte en mode API client.'],
      ...Object.entries({ disabled: 'Worker distant désactivé.', unavailable: 'Worker distant indisponible.', unknown: 'État du worker distant inconnu.', cold: 'Worker distant en préparation.', ready: 'Worker distant déclaré prêt', busy: 'Worker distant occupé.', interrupted: 'Worker distant interrompu.', incompatible: 'Worker distant incompatible' }).map(([state, expected]) => [state, { body: publicCapabilities(state) }, expected]),
      ...[401, 404, 503].map(status => [`http-${status}`, { status, body: { error: 'fixture-private-reason-never-display' } }, unknown]),
      ['malformed-json', { raw: '{invalid' }, unknown],
      ['unsupported-version', { body: { ...publicCapabilities('ready'), version: 2 } }, unknown],
      ['contradictory-readiness', { body: { ...publicCapabilities('ready'), personal: { ...publicCapabilities('ready').personal, available: false } } }, unknown],
      ['invalid-cost', { body: { ...publicCapabilities('ready'), personal: { ...publicCapabilities('ready').personal, cost: { ...publicCapabilities('ready').personal.cost, estimatedComputeUsd: -1 } } } }, unknown],
      ['timeout', { body: publicCapabilities('ready'), delay: 9000 }, unknown],
    ]
