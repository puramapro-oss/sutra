import type { LegalAppConfig, LegalSection } from '../types';
import { CURRENT_LEGAL_VERSIONS } from '../versions';

/**
 * CGV génériques. `config.clausesSpecifiquesCgv` porte la tarification/facturation réelle
 * de l'app (le socle ne peut pas l'inventer — chaque app a son propre modèle : abonnement,
 * frais de service, CPA...). Le socle fournit uniquement l'ossature légale commune
 * (rétractation, paiement sécurisé, résiliation, litiges).
 */
export function buildCGV(config: LegalAppConfig): LegalSection[] {
  if (!config.aPaiement) {
    throw new Error(
      `${config.slug}: buildCGV() appelé mais aPaiement=false — une app sans vente n'a pas de CGV, ne pas générer/monter la route /cgv.`
    );
  }
  const { company: c } = config;
  const base: LegalSection[] = [
    {
      titre: 'Champ d\'application',
      paragraphes: [
        `Les présentes conditions générales de vente régissent toute commande passée sur ${config.domaine}, édité par ${c.nom} (${c.forme_juridique}).`,
      ],
    },
  ];

  const specifiques = config.clausesSpecifiquesCgv ?? [];

  const fin: LegalSection[] = [
    {
      titre: 'Paiement',
      paragraphes: [
        "Le paiement s'effectue en ligne par carte bancaire via un prestataire de paiement sécurisé (Stripe). Aucune donnée bancaire n'est stockée par nos soins.",
      ],
    },
    {
      titre: 'Droit de rétractation',
      paragraphes: [
        "Conformément à l'article L221-28 3° du Code de la consommation, le Client renonce expressément à son droit de rétractation de 14 jours en validant sa commande et son paiement. Cette renonciation est implicite et ne nécessite aucune case à cocher.",
      ],
    },
    {
      titre: 'Résiliation',
      paragraphes: [
        "Le Client peut résilier un abonnement à tout moment depuis les paramètres de son compte. La résiliation prend effet à la fin de la période déjà payée, sans remboursement au prorata sauf disposition légale contraire.",
      ],
    },
    {
      titre: 'Facturation',
      paragraphes: [
        `Une facture numérotée séquentiellement est émise pour chaque paiement, accessible depuis l'espace « Factures » du compte. ${c.mention_tva}.`,
      ],
    },
    {
      titre: 'Modification des CGV',
      paragraphes: [
        `${c.nom} se réserve le droit de modifier les présentes CGV. Toute modification substantielle est signalée à l'utilisateur, dont l'acceptation de la nouvelle version est enregistrée avec horodatage avant tout nouveau paiement.`,
        `Version actuelle : ${CURRENT_LEGAL_VERSIONS.cgv}.`,
      ],
    },
    {
      titre: 'Droit applicable et litiges',
      paragraphes: [
        `Les présentes CGV sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents de ${c.tribunalCompetent} seront seuls compétents.`,
      ],
    },
  ];

  return [...base, ...specifiques, ...fin];
}
