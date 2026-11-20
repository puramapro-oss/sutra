import type { createServiceClient } from '@/lib/supabase'

/**
 * Client Supabase service-role partagé par les handlers de webhook Stripe.
 * Défini une seule fois pour éviter des types divergents entre modules.
 */
export type ServiceClient = ReturnType<typeof createServiceClient>
