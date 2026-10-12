// @purama/eslint-config — linter anti-débutant (CLAUDE.md §1 REVIEW, USINE-BRIEF.md §3 pt.4).
// Composé PAR-DESSUS eslint-config-next dans chaque app :
//   import puramaConfig from "@purama/eslint-config";
//   export default defineConfig([...nextVitals, ...nextTs, ...puramaConfig, globalIgnores([...])]);
//
// Ce qui est vérifiable mécaniquement vit ici. Ce qui ne l'est pas (fetch sans error+loading,
// secrets hardcodés, TODO laissé exprès) reste au REVIEW humain/agent jury-bugs — ne pas
// prétendre couvrir CLAUDE.md §1 REVIEW en entier avec du lint seul.

const puramaConfig = [
  {
    // eslint-plugin-react ≤7.37.5 crashe sous ESLint 10 lors de la détection auto de la
    // version React (context.getFilename supprimé) — version explicite = détection sautée.
    settings: {
      react: { version: "19.1" },
    },
    rules: {
      // aucun `any` — CLAUDE.md §2 loi 3, §1 REVIEW
      "@typescript-eslint/no-explicit-any": "error",

      // aucun console.log en prod — CLAUDE.md §2 loi 3 (warn/error tolérés : logs d'erreur légitimes)
      "no-console": ["error", { allow: ["warn", "error"] }],

      // aucun catch vide — CLAUDE.md §1 REVIEW
      "no-empty": ["error", { allowEmptyCatch: false }],

      // aucun fichier >300 lignes — CLAUDE.md §1 REVIEW (hors fichiers générés/config)
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],

      // aucun TODO/FIXME laissé — CLAUDE.md §2 loi 3
      "no-warning-comments": [
        "error",
        { terms: ["todo", "fixme", "xxx"], location: "start" },
      ],

      // useEffect sans cleanup dans les cas qui l'exigent — react-hooks/exhaustive-deps
      // (déjà couvert par eslint-config-next core-web-vitals, ne pas dupliquer ici)
    },
  },
  {
    // fichiers générés/config — pas soumis à la limite de lignes
    files: [
      "**/*.config.{js,mjs,ts}",
      "**/database.ts", // types Supabase générés
      "**/*.generated.{ts,tsx}",
    ],
    rules: {
      "max-lines": "off",
    },
  },
];

export default puramaConfig;
