// Compatibility endpoint: the authenticated owner check and durable claim are shared.
export { POST } from '@/app/api/social/publish/route'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120
