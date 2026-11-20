import { useEffect, useState, useCallback, useRef } from 'react'

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
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<AbortController | null>(null)
  const queryKey = JSON.stringify([page, search, planFilter, sortBy, sortOrder])
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null)

  const loadUsers = useCallback(() => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const current = () => pending.current === controller && !controller.signal.aborted
    const read = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sort: sortBy,
        order: sortOrder,
      })
      if (search) params.set('search', search)
      if (planFilter) params.set('plan', planFilter)

      const res = await fetch(`/api/admin/users?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Erreur chargement utilisateurs')
      return await res.json() as UsersResponse
    }
    return read().then(json => {
      if (!current()) return
      setData(json)
      setError(null)
    }).catch((err: unknown) => {
      if (!current()) return
      setData(null) // An unsuccessful new query cannot expose/export the previous query's users.
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }).finally(() => {
      if (!current()) return
      setLoadedQuery(queryKey)
      setLoading(false)
      pending.current = null
    })
  }, [page, search, planFilter, sortBy, sortOrder, queryKey])

  const fetchUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    return loadUsers()
  }, [loadUsers])

  useEffect(() => {
    void loadUsers()
    return () => { pending.current?.abort(); pending.current = null }
  }, [loadUsers])

  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
  }, [])

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
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
    data: loadedQuery === queryKey ? data : null,
    loading: loading || loadedQuery !== queryKey,
    error: loadedQuery === queryKey ? error : null,
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
