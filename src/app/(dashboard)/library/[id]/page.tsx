import { redirect } from 'next/navigation'

/**
 * /library/[id] — les cartes et CTA pointent ici ; la page détail/édition
 * réelle est l'éditeur. Redirection (audit #13 : routes cohérentes, aucun
 * lien mort).
 */
export default async function LibraryVideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/editor/${id}`)
}
