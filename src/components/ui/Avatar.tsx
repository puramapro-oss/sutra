'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn, getInitials, stringToColor } from '@/lib/utils'

const avatarSizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
} as const

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: keyof typeof avatarSizes
  className?: string
  'data-testid'?: string
}

export function Avatar({
  src,
  name,
  size = 'md',
  className,
  ...props
}: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initials = getInitials(name ?? null)
  const bgColor = stringToColor(name ?? 'user')
  const showImage = src && !imgError

  const pixelSize = size === 'sm' ? 32 : size === 'md' ? 40 : 56

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden font-medium select-none',
        avatarSizes[size],
        className
      )}
      style={!showImage ? { backgroundColor: bgColor } : undefined}
      {...props}
    >
      {showImage ? (
        <Image
          src={src}
          alt={name ?? 'Avatar'}
          width={pixelSize}
          height={pixelSize}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-white font-semibold">{initials}</span>
      )}
    </div>
  )
}

export default Avatar
