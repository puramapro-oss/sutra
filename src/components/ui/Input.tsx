'use client'

import { forwardRef, useId, useState } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  'data-testid'?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, onFocus, onBlur, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const [focused, setFocused] = useState(false)
    const [hasValue, setHasValue] = useState(
      Boolean(props.value || props.defaultValue)
    )

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true)
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false)
      setHasValue(Boolean(e.target.value))
      onBlur?.(e)
    }

    const isFloating = focused || hasValue

    return (
      <div className="relative w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'absolute left-4 transition-all duration-200 pointer-events-none z-10',
              isFloating
                ? '-top-2.5 text-xs px-1 bg-[#06050e] rounded'
                : 'top-1/2 -translate-y-1/2 text-sm',
              focused
                ? 'text-violet-400'
                : error
                  ? 'text-red-400'
                  : 'text-white/40'
            )}
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            setHasValue(Boolean(e.target.value))
            props.onChange?.(e)
          }}
          className={cn(
            'w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/30',
            'bg-white/[0.03] backdrop-blur-xl',
            'border transition-all duration-200 outline-none',
            focused
              ? 'border-violet-500/60 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
              : error
                ? 'border-red-500/50'
                : 'border-white/[0.06] hover:border-white/[0.12]',
            'focus-visible:ring-0',
            className
          )}
          {...props}
        />

        {error && (
          <p className="mt-1.5 text-xs text-red-400 pl-1">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
export default Input
