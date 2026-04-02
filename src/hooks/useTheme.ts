'use client'

import { useState, useEffect, useCallback } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      const stored = localStorage.getItem('sutra-theme') as Theme | null
      if (stored) {
        setThemeState(stored)
        document.documentElement.setAttribute('data-theme', stored)
      }
      setMounted(true)
    })
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('sutra-theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggleTheme, mounted }
}
