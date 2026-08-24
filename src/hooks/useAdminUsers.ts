import { useEffect, useState, useCallback } from 'react'

export interface UserRow {
  id: string
  email: string
  name: string | null
  plan: string
  is_admin: boolean
  credits: number
  wallet_balance: number
  monthly_video_count: number
  subscription_status: string | null
  created_at: string
  updated_at: string
}

interface UsersResponse {
  users: UserRow[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export function useAdminUsers() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sort: sortBy,
        order: sortOrder,
      })
      if (search) params.set('search', search)
      if (planFilter) params.set('plan', planFilter)

      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Erreur chargement utilisateurs')

      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [page, search, planFilter, sortBy, sortOrder])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearchChange = (value: string) => {
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
    setSearchTimeout(timeout)
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
    setPage(1)
  }

  return {
    data,
    loading,
    error,
    search,
    planFilter,
    sortBy,
    sortOrder,
    page,
    setPage,
    setPlanFilter,
    fetchUsers,
    handleSearchChange,
    handleSort,
  }
}
