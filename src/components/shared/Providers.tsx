'use client'

import { useEffect, useState, createContext, useContext, useCallback } from 'react'

type Theme = 'dark' | 'oled' | 'light'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  mounted: false,
})

export function useTheme() {
  return useContext(ThemeContext)
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      const stored = localStorage.getItem('sutra-theme') as Theme | null
      if (stored && ['dark', 'oled', 'light'].includes(stored)) {
        setThemeState(stored)
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        setThemeState('light')
      }
      setMounted(true)
    })
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-oled', 'theme-light')
    root.classList.add(`theme-${theme}`)
    root.setAttribute('data-theme', theme)
    localStorage.setItem('sutra-theme', theme)
  }, [theme, mounted])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const order: Theme[] = ['dark', 'oled', 'light']
      const idx = order.indexOf(prev)
      return order[(idx + 1) % order.length]
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

export default Providers
