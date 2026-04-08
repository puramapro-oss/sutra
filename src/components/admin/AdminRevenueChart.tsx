'use client'

import { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatPrice } from '@/lib/utils'

interface DataPoint {
  date: string
  amount: number
  label: string
}

export function AdminRevenueChart() {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/stats?type=revenue_chart')
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((json: { series: { date: string; amount: number }[] }) => {
        if (cancelled) return
        const formatted = (json.series ?? []).map((p) => {
          const d = new Date(p.date)
          return {
            date: p.date,
            amount: p.amount,
            label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          }
        })
        setData(formatted)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <Skeleton height={192} rounded="xl" />
  }

  const totalRevenue = data.reduce((sum, p) => sum + p.amount, 0)
  const hasData = data.some((p) => p.amount > 0)

  if (error || !hasData) {
    return (
      <div className="h-48 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-white/10 mx-auto mb-2" />
          <p className="text-xs text-white/30">
            {error ? 'Indisponible' : 'Aucun revenu sur les 90 derniers jours'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-white/40">Revenus quotidiens (90 jours)</p>
        <p className="text-xs text-amber-400 font-semibold">{formatPrice(totalRevenue)}</p>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.2)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(12,11,20,0.95)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: '#fbbf24' }}
              formatter={(value) => [formatPrice(Number(value ?? 0)), 'Revenu']}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
