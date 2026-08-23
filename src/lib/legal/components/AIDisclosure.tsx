export interface AIDisclosureProps {
  appName: string;
  /** Message additionnel selon la famille NIYAMA (ex: santé/finance — "ne remplace pas un avis professionnel"). */
  extra?: string;
  className?: string;
}

/**
 * Déclaration "vous parlez à une IA" (IA Act, transparence obligatoire) — à placer
 * visiblement en haut de toute interface de chat/assistant IA. Composant volontairement
 * minimal (pas de logique), même wording partout pour rester audité en un `grep`.
 */
export default function AIDisclosure({ appName, extra, className }: AIDisclosureProps) {
  return (
    <p className={className ?? 'text-xs text-muted-foreground'}>
      Vous échangez avec l&apos;assistant IA de {appName}, pas avec un humain.
      {extra ? ` ${extra}` : ''}
    </p>
  );
}
