'use client'

import { useSyncExternalStore } from 'react'

type Theme = 'dark' | 'oled' | 'light'
let current: Theme | undefined
const listeners = new Set<() => void>()
const valid = (value: unknown): value is Theme => value === 'dark' || value === 'oled' || value === 'light'

function getSnapshot(): Theme {
  if (!current) {
    try { const saved = localStorage.getItem('sutra-theme'); current = valid(saved) ? saved : 'dark' }
    catch { current = 'dark' }
  }
  return current
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-oled', 'theme-light')
  root.classList.add(`theme-${theme}`)
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark'
}

function setTheme(theme: Theme) {
  if (!valid(theme)) return
  current = theme
  try { localStorage.setItem('sutra-theme', theme) } catch { /* Keep the in-memory preference. */ }
  applyTheme(theme)
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  applyTheme(getSnapshot())
  const onStorage = (event: StorageEvent) => {
    if (event.key !== 'sutra-theme' && event.key !== null) return
    current = valid(event.newValue) ? event.newValue : 'dark'
    applyTheme(current)
    listeners.forEach(change => change())
  }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
}

const getServerSnapshot = () => undefined
function toggleTheme() {
  const order: Theme[] = ['dark', 'oled', 'light']
  setTheme(order[(order.indexOf(getSnapshot()) + 1) % order.length])
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { theme: theme ?? 'dark', setTheme, toggleTheme, mounted: theme !== undefined }
}
