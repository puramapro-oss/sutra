'use client'

import { DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice, formatDate } from '@/lib/utils'
import type { ReferralCommission } from '@/types'

interface CommissionsHistoryProps {
  commissions: ReferralCommission[]
}

export default function CommissionsHistory({ commissions }: CommissionsHistoryProps) {
  if (commissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <DollarSign className="h-8 w-8 text-white/15 mx-auto mb-2" />
          <p className="text-sm text-white/30">Aucune commission pour le moment</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="commissions-table">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Type</th>
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Montant</th>
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Statut</th>
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3 text-sm text-white/70 capitalize">
                  {c.status === 'paid' ? 'Payee' : c.status === 'pending' ? 'En attente' : 'Annulee'}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-emerald-400">
                  +{formatPrice(c.amount)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      c.status === 'paid' ? 'success' : c.status === 'pending' ? 'warning' : 'error'
                    }
                    size="sm"
                  >
                    {c.status === 'paid' ? 'Payee' : c.status === 'pending' ? 'En attente' : 'Annulee'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-white/40">
                  {formatDate(c.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
