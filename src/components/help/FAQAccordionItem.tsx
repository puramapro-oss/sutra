'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FAQItem } from '@/data/faq-data'

interface FAQAccordionItemProps {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}

export default function FAQAccordionItem({
  item,
  isOpen,
  onToggle,
}: FAQAccordionItemProps) {
  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-300',
        isOpen
          ? 'bg-white/[0.04] border-violet-500/20'
          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left"
        aria-expanded={isOpen}
        data-testid={`faq-toggle-${item.question.slice(0, 20).replace(/\s/g, '-').toLowerCase()}`}
      >
        <span className="text-sm sm:text-base font-medium text-white/90">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown
            className={cn(
              'w-5 h-5 transition-colors',
              isOpen ? 'text-violet-400' : 'text-white/30'
            )}
          />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
              <p className="text-sm text-white/50 leading-relaxed">
                {item.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
