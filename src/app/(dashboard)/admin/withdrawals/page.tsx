'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

const supabase = createClient()

interface Withdrawal {
  id: string
  user_id: string
  amount: number
  method: string
  details: { iban?: string; paypal_email?: string } | null
  status: string
  created_at: string
  profiles?: { email: string; name: string | null } | null
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('withdrawals')
      .select('*, profiles!withdrawals_user_id_fkey(email, name)')
      .order('created_at', { ascending: false })
      .limit(100)
    setWithdrawals((data ?? []) as Withdrawal[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const updateStatus = async (id: string, status: 'processed' | 'rejected') => {
    setProcessing(id)
    const { error } = await supabase.from('withdrawals').update({ status }).eq('id', id)
    if (error) {
      toast.error('Erreur')
    } else {
      toast.success(status === 'processed' ? 'Retrait approuve' : 'Retrait refuse')
      fetchData()
    }
    setProcessing(null)
  }

  if (loading) return <div className="text-center py-20 text-white/30">Chargement...</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-lg font-bold text-white">Demandes de retrait</h2>

      {withdrawals.length === 0 ? (
        <EmptyState icon={Clock} title="Aucune demande" description="Pas de demande de retrait en attente." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Utilisateur</th>
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Montant</th>
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">IBAN</th>
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Statut</th>
                  <th className="text-right text-xs font-medium text-white/40 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3 text-sm text-white/70">
                      {w.profiles?.name ?? w.profiles?.email ?? w.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-emerald-400">{formatPrice(w.amount)}</td>
                    <td className="px-4 py-3 text-sm text-white/40 font-mono">{w.details?.iban ?? w.details?.paypal_email ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-white/40">{formatDate(w.created_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={w.status === 'processed' ? 'success' : w.status === 'rejected' ? 'error' : 'warning'} size="sm">
                        {w.status === 'pending' ? 'En attente' : w.status === 'processed' ? 'Approuve' : 'Refuse'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {w.status === 'pending' && (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => updateStatus(w.id, 'processed')}
                            disabled={processing === w.id}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                            data-testid={`approve-${w.id}`}
                          >
                            {processing === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => updateStatus(w.id, 'rejected')}
                            disabled={processing === w.id}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            data-testid={`reject-${w.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </motion.div>
  )
}
