'use client'

import { useState, useEffect, useCallback } from 'react'

type Theme = 'dark' | 'oled' | 'light'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      const stored = localStorage.getItem('sutra-theme') as Theme | null
      if (stored && ['dark', 'oled', 'light'].includes(stored)) {
        setThemeState(stored)
        const root = document.documentElement
        root.classList.remove('theme-dark', 'theme-oled', 'theme-light')
        root.classList.add(`theme-${stored}`)
        root.setAttribute('data-theme', stored)
      }
      setMounted(true)
    })
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('sutra-theme', t)
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-oled', 'theme-light')
    root.classList.add(`theme-${t}`)
    root.setAttribute('data-theme', t)
  }, [])

  const toggleTheme = useCallback(() => {
    const order: Theme[] = ['dark', 'oled', 'light']
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % order.length])
  }, [theme, setTheme])

  return { theme, setTheme, toggleTheme, mounted }
}
