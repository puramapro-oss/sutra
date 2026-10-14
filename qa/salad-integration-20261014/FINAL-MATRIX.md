# Matrice finale SUTRA — déployé d8691d8

Cette matrice complète la photographie T08 historique ; elle ne réécrit aucun contre-test rouge ancien. La version réellement active est d8691d8ac6cf885f8e5522f361f45ebe229ec20d ; les preuves historiques sont conservées.

| Périmètre | Verdict | Preuve et limite |
| --- | --- | --- |
| Lots T02–T08 | INTEGRE | Sept SHA vérifiés, import revu,359 fichiers WIP préservés ; aucun terminal fermé. |
| MODE03/05, owner-only et absence de fallback | TESTE | Six scénarios T08 dans la gate666PASS ; preflight avant quota et fournisseur. |
| Reprise durable et conflit de workers | TESTE | T03 vrais modules +7 tests PostgreSQL réel,24 claimants/12CAS,UNKNOWN persistant ; aucun double calcul simulé. |
| T05 média source déguisée | CORRIGE / TESTE | Contre-test désormais vert ;59tests média dont FFmpeg réel. |
| T06 reconnexion revoked/expired/error | CORRIGE / TESTE | Tests sociaux intégrés et preuves navigateur T07 ; consentement réel non effectué. |
| Contrats et sécurité | TESTE | 666PASS,0FAIL,7SKIP explicites ; scripts/providers/journaux/OAuth/SSRF/isolation. |
| TypeScript/lint/build | TESTE | Gates locales vertes,111avertissements hérités. |
| Interface modes | TESTE | T07 cinq largeurs,52checks/51axe ; delta texte T01 4checks/3axe sans violation. |
| Persistance Salad en production | DESACTIVE | Migration testée PostgreSQL local/CI seulement ; pas de migration OVH ni accès au journal par application désactivée. |
| Mode API clients | TESTE EN SIMULATION | Routage et réponse202 couverts ; vraie génération cliente NON TESTEE, consentement de dépense absent. |
| RunPod / Shotstack | AUTHENTIFIES | Health endpoint et templates stage/v1 conformes depuis runtime après synchronisation ; génération NON TESTEE. |
| Suno | AUTHENTIFIE / CONTRATS TESTES | Adaptateur tiers SunoAPI existant ; aucune revendication API officielle Suno ni génération musicale réelle. |
| Zernio | CONFIGURE / AUTHENTIFIE | Identité serveur et profil possédé vérifiés, profil existant conservé ; zéro compte social connecté au reçu. |
| Ressource Salad / modèle24Go / isolation réseau réelle | BLOQUE / NON TESTE | Aucun GPU créé, aucun budget autorisé, aucun modèle/container réellement qualifié. |
| Parcours continu DB réelle → vidéo réelle → publication | NON TESTE | Preuves segmentées gratuites ; aucune génération ni publication demandée au fournisseur. |
| Cron valide, publication et consentement OAuth réels | NON TESTE | Seulement refus/contrats gratuits ; interventions utilisateur et éventuelle dépense nécessaires. |
| CI exacte / candidat / déploiement | TESTE / DEPLOYE | Trois jobs CI PASS, candidat isolé,141 tables restaurées, ancienne image testée ; deployment.json au SHA d8691d8, runtime sain. |
| E2E intégrés | TESTE | Chromium210 +7 contrôles,165 axe ; legacy1022 PASS/25 SKIP,0 flaky. |
| Smoke public/auth/médias/sécurité | TESTE | Desktop/mobile inspectés ;8 GET public/interne +7 authentifiés +3 bibliothèque/SRT ;58 refus sécurité +30 médias PASS. |
| Dépendances | GATE PASS / RISQUES RESTANTS |0 high/critical ;2 low,5 moderate,111 warnings lint hérités. |

Limitations restantes : pas de preuve GPU, compatibilité24Go, facture réelle, DNS-rebinding réseau réel, clavier/lecteur d'écran exhaustifs, charge distante/SLA ni alertes bout en bout. Les mocks/HTTP200 et tests locaux ne prouvent pas ces propriétés.
