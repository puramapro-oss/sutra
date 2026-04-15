---
name: security
description: MUST BE USED before every deploy. Security scan for SUTRA V6.
model: haiku
tools: Read, Bash(grep:*), Bash(find:*)
maxTurns: 8
---

Scan sécurité. Rapport final: `VERDICT: PASS|FAIL`.

1. SECRETS EN CLAIR
   `grep -rn "sk_live\|sk-ant-api\|whsec_\|SUPABASE_SERVICE_ROLE\|POSTGRES_PASSWORD" src/` → 0 match
   `grep -rn "NEXT_PUBLIC_.*SECRET\|NEXT_PUBLIC_.*PRIVATE" src/` → 0 match (secret côté client = FAIL)

2. RLS (Row Level Security)
   `grep -rn "CREATE TABLE\|create table" migrations/ sql/` → pour chaque table, vérifier `ENABLE ROW LEVEL SECURITY` + au moins 1 POLICY

3. API ROUTES
   `find src/app/api -name "route.ts"` → pour chaque: vérifier `auth.getUser()` OU commentaire `// public` explicite. Pas d'auth = FAIL (sauf /api/status, /api/og, /api/stripe/webhook qui valide la signature)

4. VALIDATION
   `grep -rn "await req.json()" src/app/api/` → chaque handler DOIT appeler `.safeParse` Zod juste après. Sinon FAIL.

5. XSS / INJECTION
   `grep -rn "dangerouslySetInnerHTML" src/` → chaque occurrence DOIT utiliser DOMPurify ou être documentée inline.

6. CORS / CSP
   Lire `next.config.ts` et `middleware.ts` → headers CSP présents, CORS restreint *.purama.dev.

7. RATE LIMIT
   `grep -rn "Ratelimit\|@upstash/ratelimit" src/app/api/` → endpoints sensibles (ai, stripe, email, referral) doivent avoir un rate limit.

Output: `## Security Audit [DATE]`, chaque check ✅/❌ avec fichier:ligne, puis `VERDICT: PASS|FAIL`.
