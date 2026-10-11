'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHydrated } from '@/hooks/useHydrated'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  className?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  'data-testid'?: string
}

const dialogs: HTMLDivElement[] = []
let savedOverflow = ''
const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, children, title, className, initialFocusRef, 'data-testid': testId = 'modal' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  const mounted = useHydrated()

  useEffect(() => {
    const dialog = modalRef.current
    if (!mounted || !open || !dialog) return
    const previousFocus = document.activeElement as HTMLElement | null
    if (!dialogs.length) { savedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    dialogs.push(dialog)
    const focusables = () => [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter(el => el.getClientRects().length > 0 && el.tabIndex >= 0)
    const frame = requestAnimationFrame(() => (initialFocusRef?.current ?? focusables()[0] ?? dialog).focus())

    const keydown = (event: KeyboardEvent) => {
      if (dialogs[dialogs.length - 1] !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      const first = items[0] ?? dialog
      const last = items[items.length - 1] ?? dialog
      if (!items.length || !dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', keydown, true)
      const index = dialogs.indexOf(dialog)
      if (index !== -1) dialogs.splice(index, 1)
      if (!dialogs.length) document.body.style.overflow = savedOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [mounted, open, initialFocusRef])

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={modalRef} role="dialog" aria-modal="true" aria-label={title ?? 'Fenêtre'} tabIndex={-1} data-testid={testId}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={cn('relative z-10 w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#0c0b14]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl shadow-black/50', className)}
          >
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
              {title ? <h2 className="text-lg font-semibold text-white">{title}</h2> : <span />}
              <button type="button" onClick={onClose} aria-label="Fermer" data-testid="modal-close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-6 pt-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>, document.body
  )
}

export default Modal
