export function oauthErrorMessage(error: string | null): string | null {
  if (!error) return null
  return error === 'invalid_or_expired_state'
    ? 'Ce lien a expiré ou a déjà été utilisé. Relance la connexion depuis cette page.'
    : error === 'session_required'
      ? 'Ta session a expiré. Reconnecte-toi à SUTRA, puis relance la connexion du compte.'
      : error === 'oauth_denied'
        ? 'Autorisation refusée. Aucun compte ajouté ; tu peux réessayer si tu le souhaites.'
        : error === 'oauth_empty_profile'
          ? 'Aucun compte autorisé trouvé. Relance la connexion et sélectionne le compte souhaité.'
          : error === 'db_error'
            ? 'Impossible d’enregistrer la connexion. Vérifie la liste des comptes avant de réessayer.'
            : 'Connexion indisponible. Relance la connexion depuis cette page.'
}
