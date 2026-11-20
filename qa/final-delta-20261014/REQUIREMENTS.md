# Candidat intégré T01 — 14 octobre 2026

Base b7cf848, production avant promotion d8691d8. Sept deltas exacts, sans WIP ni merge aveugle. Les dépendances Suno T03/T04 sont intégrées ensemble. Runtime conservé ; seul le SELECT authenticated sur les affirmations a ensuite été corrigé par la migration 6800a8d, avec sauvegarde et régressions ciblées. Détails de provenance dans import-t02..t08.json.

| Lot | SHA livré | État |
|---|---|---|
| T02 | `a01c7a26f60280953187b33401d46a9c27985661` | base b7cf848, arbre propre, delta revu/importé |
| T03 | `fe99ebe26f409bf9eccfddf6346004b601e9bac1` | base b7cf848, arbre propre, delta revu/importé |
| T04 | `0e2084578bb5283f6334f0ad1ce2525fa86ed194` | base b7cf848, arbre propre, delta revu/importé |
| T05 | `942d9e557945c7ad12405775aaa25a4ba94ae2d9` | base b7cf848, arbre propre, delta revu/importé |
| T06 | `c562b78f7567be00ce7bb82a86ef627b74a1c821` | base b7cf848, arbre propre, delta revu/importé |
| T07 | `654ae42a587d9934dbb29a63ec75eeec19062d72` | base b7cf848, arbre propre, delta revu/importé |
| T08 | `6146c76162dd1fa3c90e727f9d621b78d6534bac` | base b7cf848, arbre propre, delta revu/importé |

Livré : stockage lié au propriétaire, preuve publique expurgée, transport OTS borné ; fin de job/résultats/voix persistants, reprise Suno GET avec ID immuable ; réponses médias/providers bornées, drainage worker, interfaces Comfy ; sous-titres4K et validation composition ; OAuth refus/state/version/CAS/révocation ambiguë ; pagination/filtres/contraste ; parcours queue/doubles clics/erreurs.

T01 : raccord CI (contrats et médias nouveaux, PostgreSQL concurrence/révocation, navigateur T07), messages sociaux409/503 reproduits2FAIL puis4PASS, messages locaux fixes sans contenu fournisseur. Browser couvre aussi375/1440. Aucun compte connecté ou contenu publié.

Campagne finale : PASS au SHA exact 86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164, CI38508390596 et promotion OVH prouvées. Voir FINAL-TESTS.json et FINAL-MATRIX.md. Ne pas additionner les résultats propriétaires : recouvrements. GitNexus HIGH/CRITICAL signalé ; correspondance JSX/génériques et index tronqué = exhaustivité UNKNOWN, revue directe des deltas jointe aux impacts. Gitleaks et detect_changes requis avant commit.

Runtime conservé et vérifié après promotion : RunPod endpoint health200 avec contrat valide (zéro worker prêt), Shotstack stage/v1 templates200 avec schémas valides, Zernio owner/profil PURAMA et liaison unique vérifiés, zéro compte connecté. Sauvegarde/restauration et rollback image testés. Migration SQL limitée aux affirmations testée et appliquée séparément, sans donnée modifiée.

BLOQUÉ externe : Salad désactivé, ressource/budget/image licenciée/qualification GPU manquants ; aucune génération GPU réelle prouvée. Zernio zéro compte connecté, consentement utilisateur requis. Cron/worker autonome OVH absent : reprise automatique et publication planifiée NON ACTIVES. Aucune activation susceptible de générer/publier dans cette recette.

NON TESTÉ : génération/rendu/publication réels, OAuth fournisseur consenti, PostgREST transport des courses OAuth (SQL réel testé), Cloudflare API sans credential. HTTP200 fournisseur ne prouve pas une génération.
