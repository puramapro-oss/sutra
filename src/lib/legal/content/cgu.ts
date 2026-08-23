import type { LegalAppConfig, LegalSection } from '../types';
import { CURRENT_LEGAL_VERSIONS } from '../versions';

/**
 * CGU génériques — socle commun aux ~90 apps. `config.clausesSpecifiquesCgu` insère les
 * clauses propres au modèle d'affaires de l'app (tarification, annulation, obligations
 * spécifiques...) entre le bloc générique d'ouverture et le bloc générique de clôture
 * (RGPD/suppression de compte/litiges, identiques partout). La rétractation vit UNIQUEMENT
 * dans les CGV (`cgv.ts`) — elle n'a de sens que s'il y a une commande/un paiement, donc
 * jamais dans les CGU d'une app sans `aPaiement`. Les sections ne portent pas de numéro en
 * dur — `LegalPage` numérote à l'affichage selon l'ordre final du tableau, pour ne jamais
 * entrer en collision avec les clauses insérées.
 */
export function buildCGU(config: LegalAppConfig): LegalSection[] {
  const { company: c } = config;
  const base: LegalSection[] = [
    {
      titre: 'Objet du service',
      paragraphes: [
        `${config.nom} est une plateforme numérique éditée par ${c.nom} (${c.forme_juridique}). ${config.descriptionActivite}`,
      ],
    },
    {
      titre: 'Inscription et compte utilisateur',
      paragraphes: [
        `L'inscription à ${config.nom} est gratuite et ouverte à toute personne majeure. Chaque utilisateur garantit l'exactitude des informations fournies lors de l'inscription et s'engage à les maintenir à jour.`,
        "Les identifiants de connexion sont personnels et confidentiels. L'utilisateur est seul responsable de leur utilisation.",
      ],
    },
    ...(config.aChatIA
      ? [
          {
            titre: "Déclaration d'usage de l'intelligence artificielle",
            paragraphes: [
              `${config.nom} fait appel à des modèles d'intelligence artificielle pour tout ou partie de ses fonctionnalités. Conformément au règlement européen sur l'IA (IA Act), l'utilisateur est explicitement informé, dans l'interface elle-même, lorsqu'il interagit avec une IA plutôt qu'un humain. Les réponses générées par IA sont fournies à titre informatif et ne remplacent pas l'avis d'un professionnel qualifié lorsque le sujet le requiert (santé, juridique, financier...).`,
            ],
          },
        ]
      : []),
  ];

  const specifiques = config.clausesSpecifiquesCgu ?? [];

  const fin: LegalSection[] = [
    {
      titre: 'Protection des données personnelles',
      paragraphes: [
        `Conformément au RGPD, les données collectées sont traitées par ${c.nom} dans le cadre de la fourniture du service. L'utilisateur dispose d'un droit d'accès, de rectification, de portabilité et de suppression de ses données, exerçable depuis la page « Ma mémoire » du compte ou par email à ${c.emailContact}.`,
        'Voir la Politique de confidentialité pour le détail des traitements.',
      ],
    },
    {
      titre: 'Suppression de compte',
      paragraphes: [
        "L'utilisateur peut demander la suppression de son compte à tout moment depuis la page « Ma mémoire ». La suppression entraîne l'effacement des données personnelles et de l'historique associé, sous réserve des obligations légales de conservation (comptable, fiscale) qui priment temporairement sur l'effacement.",
      ],
    },
    {
      titre: 'Responsabilité de la plateforme',
      paragraphes: [
        `${c.nom} met en œuvre les moyens techniques nécessaires au bon fonctionnement de la plateforme, mais ne peut garantir une disponibilité absolue.`,
      ],
    },
    {
      titre: 'Modification des CGU',
      paragraphes: [
        `${c.nom} se réserve le droit de modifier les présentes CGU. Toute modification substantielle est signalée à l'utilisateur, dont l'acceptation de la nouvelle version est enregistrée avec horodatage avant toute nouvelle utilisation du service.`,
        `Version actuelle : ${CURRENT_LEGAL_VERSIONS.cgu}.`,
      ],
    },
    {
      titre: 'Droit applicable et litiges',
      paragraphes: [
        `Les présentes CGU sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents de ${c.tribunalCompetent} seront seuls compétents.`,
      ],
    },
  ];

  return [...base, ...specifiques, ...fin];
}
