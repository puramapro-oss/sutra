import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

// V6 Section 17 — Récapitulatif annuel PDF (simple HTML imprimable)
// Pour un vrai PDF, intégrer puppeteer ou jsPDF. Ici on sert un HTML avec
// Content-Disposition attachment pour impression navigateur.

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .single()

  const year = new Date().getFullYear()
  const yearStart = new Date(year, 0, 1).toISOString()

  const { data: txs } = await service
    .from('wallet_transactions')
    .select('amount, source, description, created_at')
    .eq('user_id', user.id)
    .eq('type', 'credit')
    .gte('created_at', yearStart)
    .order('created_at', { ascending: true })

  const totals = (txs ?? []).reduce(
    (acc, t) => {
      const amt = Number(t.amount) || 0
      acc.total += amt
      const src = String(t.source ?? '')
      if (src.startsWith('prime_')) acc.primes += amt
      else if (src === 'referral') acc.parrainage += amt
      else if (src.startsWith('nature')) acc.nature += amt
      else if (src === 'marketplace') acc.marketplace += amt
      else if (src === 'mission') acc.missions += amt
      return acc
    },
    { total: 0, primes: 0, parrainage: 0, nature: 0, marketplace: 0, missions: 0 }
  )

  await service.from('annual_summaries').upsert(
    {
      user_id: user.id,
      year,
      total_primes: totals.primes,
      total_parrainage: totals.parrainage,
      total_nature: totals.nature,
      total_marketplace: totals.marketplace,
      total_missions: totals.missions,
      total_annuel: totals.total,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,year' }
  )

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Récapitulatif fiscal ${year} — Purama</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; color: #111; max-width: 800px; margin: 40px auto; padding: 0 30px; line-height: 1.5; }
  h1 { color: #7C3AED; margin-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 30px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #ddd; }
  th { background: #f5f5f7; font-weight: 600; }
  td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  .total { font-weight: 700; background: #fff9e0; }
  .legal { font-size: 11px; color: #555; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 15px; }
</style></head>
<body>
<h1>Récapitulatif fiscal ${year}</h1>
<div class="meta">
  <strong>${profile?.name ?? 'Utilisateur'}</strong> — ${profile?.email ?? user.email}<br>
  Généré le ${new Date().toLocaleDateString('fr-FR')}<br>
  Période : du 01/01/${year} au 31/12/${year}
</div>

<table>
  <thead><tr><th>Catégorie de gain</th><th style="text-align:right">Montant (€)</th></tr></thead>
  <tbody>
    <tr><td>Primes Purama</td><td class="amount">${totals.primes.toFixed(2)}</td></tr>
    <tr><td>Commissions de parrainage</td><td class="amount">${totals.parrainage.toFixed(2)}</td></tr>
    <tr><td>Nature Rewards</td><td class="amount">${totals.nature.toFixed(2)}</td></tr>
    <tr><td>Marketplace</td><td class="amount">${totals.marketplace.toFixed(2)}</td></tr>
    <tr><td>Missions rémunérées</td><td class="amount">${totals.missions.toFixed(2)}</td></tr>
    <tr class="total"><td>TOTAL ${year}</td><td class="amount">${totals.total.toFixed(2)}</td></tr>
  </tbody>
</table>

<p>À déclarer en case <strong>5NG</strong> sur impots.gouv.fr. Abattement forfaitaire de 34 % appliqué automatiquement.</p>

<div class="legal">
Les gains perçus via Purama peuvent être soumis à l'impôt sur le revenu selon votre situation fiscale et le montant perçu.
En France, un seuil de déclaration s'applique à partir de 3 000 € de revenus annuels via des plateformes numériques.
Purama ne saurait être tenu responsable des obligations fiscales individuelles de ses utilisateurs.
Consultez un conseiller fiscal pour votre situation personnelle.<br><br>
SASU PURAMA — 8 Rue de la Chapelle, 25560 Frasne — art. 293B CGI
</div>
</body></html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="recapitulatif-sutra-${year}.html"`,
    },
  })
}
