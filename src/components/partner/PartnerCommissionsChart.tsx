'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface MonthlyPoint {
  month: string
  count: number
  commissions: number
}

export function PartnerCommissionsChart({
  data,
  loading,
}: {
  data: MonthlyPoint[]
  loading: boolean
}) {
  if (loading) {
    return <div className="h-64 rounded-lg bg-white/[0.02] animate-pulse" />
  }

  const hasData = data.some((p) => p.count > 0 || p.commissions > 0)

  if (!hasData) {
    return (
      <div className="h-64 flex items-center justify-center rounded-lg bg-white/[0.02] border border-dashed border-white/[0.08]">
        <div className="text-center">
          <TrendingUp className="h-8 w-8 text-white/15 mx-auto mb-2" />
          <p className="text-sm text-white/30">Pas encore de données</p>
          <p className="text-xs text-white/20 mt-1">
            Tes commissions apparaîtront ici dès tes premiers filleuls.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="commissionsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="month"
            stroke="rgba(255,255,255,0.3)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgba(255,255,255,0.3)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(12,11,20,0.95)',
              border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#c084fc' }}
            formatter={(value, name) => {
              const num = Number(value ?? 0)
              if (name === 'commissions') return [formatPrice(num), 'Commissions']
              return [num, 'Filleuls']
            }}
          />
          <Bar dataKey="commissions" fill="url(#commissionsGradient)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
