'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun,
  Moon,
  LogOut,
  User,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import NotificationBell from '@/components/layout/NotificationBell'
import SearchModal from '@/components/layout/SearchModal'

export default function Header() {
  const router = useRouter()
  const { user, profile, signOut } = useAuth()
  const { theme, toggleTheme, mounted } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setDropdownOpen(false)
    await signOut()
    window.location.href = '/login'
  }

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'Utilisateur'
  const initials = getInitials(profile?.name ?? null)

  return (
    <header
      className="sticky top-0 z-30 h-16 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl"
      data-testid="header"
    >
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: Mobile logo */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="lg:hidden flex items-center gap-2"
            data-testid="header-logo"
          >
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
              <span className="font-display text-[10px] font-bold text-white">
                S
              </span>
            </div>
          </Link>

          <div className="hidden lg:block" data-testid="header-logo" />
        </div>

        {/* Center: Search (Cmd+K) */}
        <SearchModal />

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              data-testid="theme-toggle"
            >
              {theme === 'dark' ? (
                <Sun className="w-4.5 h-4.5" />
              ) : (
                <Moon className="w-4.5 h-4.5" />
              )}
            </button>
          )}

          {/* Notifications */}
          <NotificationBell />

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
              data-testid="user-menu"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
              )}
              <span className="hidden md:block text-sm text-white/70 max-w-[120px] truncate">
                {displayName}
              </span>
              <ChevronDown
                className={cn(
                  'hidden md:block w-3.5 h-3.5 text-white/30 transition-transform duration-200',
                  dropdownOpen && 'rotate-180'
                )}
              />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 py-1.5 rounded-xl bg-[#0f0e1a]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50 z-50"
                >
                  {/* User info */}
                  <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
                    <p className="text-sm font-medium text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {user?.email ?? ''}
                    </p>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    data-testid="dropdown-profile"
                  >
                    <User className="w-4 h-4" />
                    Profil
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    data-testid="dropdown-settings"
                  >
                    <Settings className="w-4 h-4" />
                    Parametres
                  </Link>

                  <div className="border-t border-white/[0.06] mt-1 pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                      data-testid="dropdown-signout"
                    >
                      <LogOut className="w-4 h-4" />
                      Se deconnecter
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
