import type { LegalAppConfig, LegalSection } from '../types';

/**
 * Mentions légales génériques — généralisées depuis `pashu/src/app/(public)/mentions-legales/page.tsx`
 * (contenu vérifié D-047, ref PIEGES.md 2026-08-07). Aucune clause spécifique marketplace conservée ici.
 */
export function buildMentionsLegales(config: LegalAppConfig): LegalSection[] {
  const { company: c, mediateur } = config;
  const siretLigne = c.siret ? `SIRET : ${c.siret}` : "SIRET en cours d'attribution";
  const mediateurLigne = mediateur.nom
    ? `Coordonnées du médiateur : ${mediateur.nom}${mediateur.url ? ` (${mediateur.url})` : ''}`
    : "Coordonnées du médiateur : en cours de désignation — à ce jour aucun médiateur de la consommation agréé n'est souscrit pour l'écosystème PURAMA.";

  return [
    {
      titre: 'Éditeur du site',
      paragraphes: [
        `Le site ${config.domaine} est édité par :`,
        `${c.nom} (${c.forme_juridique})\nAdresse : ${c.adresse}, ${c.code_postal} ${c.commune}, ${c.pays}\n${siretLigne}\n${c.mention_tva}\nEmail de contact : ${c.emailContact}`,
        `Directeur de la publication : ${c.directeurPublication}`,
      ],
    },
    {
      titre: 'Hébergement',
      paragraphes: [
        `Le site ${config.domaine} est hébergé par :`,
        'Vercel Inc.\n440 N Barranca Avenue #4133\nCovina, CA 91723\nÉtats-Unis',
        'Les données de compte et données applicatives sont hébergées sur un serveur dédié situé en Union européenne :',
        'Hostinger International Ltd\nInfrastructure UE (serveur physique situé à Paris, France)',
      ],
    },
    {
      titre: 'Propriété intellectuelle',
      paragraphes: [
        `L'ensemble du contenu de ce site (structure, textes, logos, graphismes, images, logiciels) est la propriété exclusive de ${c.nom}, sauf mentions contraires.`,
        `Toute reproduction, distribution, modification, adaptation, retransmission ou publication de ces différents éléments est strictement interdite sans l'accord écrit de ${c.nom}.`,
        `Le nom « ${config.nom} » ainsi que le logo sont des marques de ${c.nom}.`,
      ],
    },
    {
      titre: 'Protection des données personnelles',
      paragraphes: [
        "Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données personnelles.",
        'Pour exercer ces droits, vous pouvez :',
      ],
      liste: [
        `Consulter, exporter et effacer vos données depuis la page « Ma mémoire » de votre compte.`,
        `Nous contacter par email à : ${c.emailContact}`,
      ],
    },
    {
      titre: 'Cookies et traceurs',
      paragraphes: [
        `Le site ${config.domaine} utilise des cookies strictement nécessaires au fonctionnement de la plateforme (authentification, session utilisateur). Aucun cookie de mesure d'audience ou publicitaire n'est déposé sans votre consentement préalable.`,
        'Vous pouvez à tout moment gérer vos préférences de cookies via le bandeau de consentement ou les paramètres de votre navigateur.',
      ],
    },
    ...(config.aChatIA
      ? [
          {
            titre: 'Intelligence artificielle',
            paragraphes: [
              `${config.nom} propose des fonctionnalités reposant sur des modèles d'intelligence artificielle. Conformément au règlement européen sur l'IA (IA Act), toute conversation avec un assistant IA est signalée comme telle dans l'interface : vous savez toujours quand vous interagissez avec une IA plutôt qu'un humain.`,
            ],
          },
        ]
      : []),
    {
      titre: 'Limitation de responsabilité',
      paragraphes: [
        `${c.nom} s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur le site ${config.domaine}, mais ne peut garantir l'absence totale d'erreurs ou d'omissions.`,
        `${c.nom} ne saurait être tenue responsable de tout dommage direct ou indirect résultant de l'utilisation du site ou de l'impossibilité d'y accéder, ni de tout préjudice lié à l'intrusion d'un tiers ayant entraîné une modification des informations mises à disposition.`,
      ],
    },
    {
      titre: 'Droit applicable et juridiction compétente',
      paragraphes: [
        `Les présentes mentions légales sont régies par le droit français. En cas de litige, une solution amiable sera recherchée en priorité. À défaut d'accord, les tribunaux compétents de ${c.tribunalCompetent} seront seuls compétents.`,
      ],
    },
    {
      titre: 'Médiation',
      paragraphes: [
        `Conformément à l'article L612-1 du Code de la consommation, le Client a le droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un litige l'opposant à ${c.nom}.`,
        mediateurLigne,
      ],
    },
  ];
}
