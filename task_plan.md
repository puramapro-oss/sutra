## Goal
Conformite legale francaise SUTRA: CGU, CGV, Privacy, Cookies, Mentions legales, banniere RGPD, checkbox CGU signup. + Fix re-render.

## Phases
- [x] Phase 1: Diagnostic — pages legales existantes (terms, privacy, cookies), signup sans checkbox, cookie banner existant ✓
- [x] Phase 2: /legal + /legal/mentions — mentions legales PURAMA SASU ✓
- [x] Phase 3: /legal/terms — CGU mises a jour avec PURAMA SASU ✓
- [x] Phase 4: /legal/cgv — CGV completes creees (10 articles) ✓
- [x] Phase 5: /legal/privacy — mise a jour PURAMA SASU ✓
- [x] Phase 6: /legal/cookies — OK (existait deja) ✓
- [x] Phase 7: Cookie banner — ajout lien "En savoir plus" vers /legal/cookies ✓
- [x] Phase 8: Checkbox CGU obligatoire a l'inscription ✓
- [x] Phase 9: Fix re-render confirme (useAuth + deps profile?.id) ✓
- [x] Phase 10: Build + deploy + 51/51 tests Playwright ✓

## Decisions
- PURAMA SASU, capital 1 euro, 8 Rue de la Chapelle, 25560 Frasne
- Art. 293B CGI (TVA non applicable)
- Checkbox obligatoire lie aux CGU + CGV + Privacy
- Cookie banner: 3 categories (essentiel/analytics/marketing) + lien politique

## Errors
Aucune
