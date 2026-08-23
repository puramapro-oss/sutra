import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import MaMemoirePage from '@/lib/legal/components/MaMemoirePage'

export default async function MaMemoire() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/ma-memoire')

  const [{ data: acceptances }, { data: deletionRequest }] = await Promise.all([
    supabase.from('legal_acceptances').select('doc_type, version, accepted_at').eq('user_id', user.id),
    supabase
      .from('account_deletion_requests')
      .select('scheduled_for')
      .eq('user_id', user.id)
      .eq('status', 'scheduled')
      .maybeSingle(),
  ])

  return (
    <MaMemoirePage
      appName="SUTRA"
      acceptations={(acceptances ?? []).map((a) => ({
        docType: a.doc_type,
        version: a.version,
        acceptedAt: a.accepted_at,
      }))}
      deletionScheduledFor={deletionRequest?.scheduled_for ?? null}
    />
  )
}
