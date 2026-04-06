import { z } from 'zod'

export const stockSelectionSchema = z.object({
  sceneIndex: z.number().int().min(0),
  source: z.enum(['pexels', 'unsplash', 'coverr']).nullable(),
  type: z.enum(['video', 'photo']).nullable(),
  url: z.string().url().nullable(),
  thumbnail: z.string().url().nullable(),
  quality: z.enum(['1080p', '4k']).nullable(),
  fallbackToAI: z.boolean().default(false),
})

export const createVideoSchema = z.object({
  topic: z.string().min(3, 'Le sujet doit contenir au moins 3 caracteres').max(500),
  format: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  quality: z.enum(['720p', '1080p', '4k']).default('1080p'),
  voice_id: z.string().optional(),
  niche: z.string().optional(),
  style: z.string().optional(),
  mode: z.enum(['auto', 'manual']).default('auto'),
  mediaMode: z.enum(['ai', 'stock', 'mixed']).default('ai'),
  stockSelections: z.array(stockSelectionSchema).optional().default([]),
})

export const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caracteres'),
  name: z.string().min(2, 'Minimum 2 caracteres').max(50),
})

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const profileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  preferred_niche: z.string().optional(),
  preferred_voice_style: z.string().optional(),
  preferred_quality: z.enum(['720p', '1080p', '4k']).optional(),
  theme_mode: z.enum(['dark', 'light']).optional(),
})

export const withdrawalSchema = z.object({
  amount: z.number().min(50, 'Minimum 50 EUR').max(1000, 'Maximum 1000 EUR'),
  method: z.enum(['paypal', 'bank']),
  details: z.object({
    iban: z.string().optional(),
    bic: z.string().optional(),
    paypal_email: z.string().email().optional(),
  }),
})

export const contactSchema = z.object({
  subject: z.string().min(5).max(200),
  message: z.string().min(10).max(2000),
  email: z.string().email(),
})

export type CreateVideoInput = z.infer<typeof createVideoSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ProfileInput = z.infer<typeof profileSchema>
export type WithdrawalInput = z.infer<typeof withdrawalSchema>
