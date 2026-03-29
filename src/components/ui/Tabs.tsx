'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (tabId: string) => void
  children: (activeTab: string) => React.ReactNode
  className?: string
  'data-testid'?: string
}

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  children,
  className,
  ...props
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '')
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const updateIndicator = useCallback(() => {
    const activeEl = tabRefs.current.get(activeTab)
    const container = containerRef.current
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect()
      const tabRect = activeEl.getBoundingClientRect()
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      })
    }
  }, [activeTab])

  useEffect(() => {
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [updateIndicator])

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }

  return (
    <div className={cn('w-full', className)} {...props}>
      <div
        ref={containerRef}
        className="relative flex items-center gap-1 border-b border-white/[0.06] pb-px"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el)
            }}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              'relative px-4 py-2.5 text-sm font-medium transition-colors duration-200 whitespace-nowrap flex items-center gap-2',
              activeTab === tab.id
                ? 'text-violet-400'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}

        <motion.div
          className="absolute bottom-0 h-0.5 bg-violet-500 rounded-full"
          animate={{ left: indicator.left, width: indicator.width }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      </div>

      <div className="mt-4" role="tabpanel">
        {children(activeTab)}
      </div>
    </div>
  )
}

export default Tabs
