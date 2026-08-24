'use client'

import { Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'
import type { Filleul } from '@/hooks/useReferralData'

interface FilleulsListProps {
  filleuls: Filleul[]
}

export default function FilleulsList({ filleuls }: FilleulsListProps) {
  if (filleuls.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aucun filleul"
        description="Partage ton code pour commencer a gagner des commissions."
        data-testid="filleuls-empty"
      />
    )
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="filleuls-table">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Nom</th>
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Date</th>
              <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filleuls.map((f) => (
              <tr key={f.id} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3">
                  <p className="text-sm text-white/70">{f.name ?? f.email}</p>
                </td>
                <td className="px-4 py-3 text-sm text-white/40">
                  {formatDate(f.created_at)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={f.status === 'active' ? 'success' : 'error'} size="sm">
                    {f.status === 'active' ? 'Actif' : 'Annule'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
