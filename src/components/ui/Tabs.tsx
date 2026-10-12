'use client'

import { useState, useRef, useId } from 'react'
import { cn } from '@/lib/utils'

interface Tab { id: string; label: string; icon?: React.ReactNode }
interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (tabId: string) => void
  children: (activeTab: string) => React.ReactNode
  className?: string
  'data-testid'?: string
}

export function Tabs({ tabs, defaultTab, onChange, children, className, ...props }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '')
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const id = useId()
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }

  return (
    <div className={cn('w-full min-w-0', className)} {...props}>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] p-1" role="tablist" aria-label="Sections">
        {tabs.map((tab, index) => (
          <button
            key={tab.id} type="button"
            ref={el => { if (el) tabRefs.current.set(tab.id, el); else tabRefs.current.delete(tab.id) }}
            id={`${id}-tab-${tab.id}`} role="tab" aria-selected={activeTab === tab.id}
            aria-controls={`${id}-panel`} tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={event => {
              let next: number
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
              else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = tabs.length - 1
              else return
              event.preventDefault()
              handleTabClick(tabs[next].id)
              tabRefs.current.get(tabs[next].id)?.focus()
            }}
            className={cn(
              'shrink-0 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 border-b-2',
              activeTab === tab.id ? 'text-violet-400 border-violet-500' : 'text-white/65 hover:text-white/80 border-transparent'
            )}
          >{tab.icon}{tab.label}</button>
        ))}
      </div>
      <div id={`${id}-panel`} className="mt-4" role="tabpanel" aria-labelledby={`${id}-tab-${activeTab}`} tabIndex={0}>
        {children(activeTab)}
      </div>
    </div>
  )
}
export default Tabs
