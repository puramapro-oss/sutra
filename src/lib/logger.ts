import { createServiceClient } from '@/lib/supabase'

export async function logApiCall(
  userId: string | null,
  service: string,
  endpoint: string,
  status: string,
  responseTimeMs?: number,
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('api_logs').insert({
      user_id: userId,
      service,
      endpoint,
      status,
      response_time_ms: responseTimeMs ?? null,
      estimated_cost: estimateCost(service),
      error_message: errorMessage ?? null,
    })
  } catch {
    // Don't crash on logging failures
  }
}

export async function logActivity(
  userId: string | null,
  type: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('activity_logs').insert({
      user_id: userId,
      type,
      description,
      metadata: metadata ?? null,
    })
  } catch {
    // Don't crash on logging failures
  }
}

export async function logError(
  userId: string | null,
  section: string,
  severity: 'warning' | 'error' | 'critical',
  message: string,
  stack?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('error_logs').insert({
      user_id: userId,
      section,
      severity,
      message,
      stack: stack ?? null,
      metadata: metadata ?? null,
    })
  } catch {
    // Don't crash
  }
}

export async function sendNotification(
  userId: string,
  notification: {
    type: string
    title: string
    message: string
  }
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('user_notifications').insert({
      user_id: userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
    })
  } catch {
    // Don't crash
  }
}

export async function sendAdminNotification(notification: {
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('admin_notifications').insert({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data ?? null,
    })
  } catch {
    // Don't crash
  }
}

function estimateCost(service: string): number {
  const costs: Record<string, number> = {
    claude: 0.05,
    elevenlabs: 0.1,
    runpod: 0.015,
    suno: 0.08,
    shotstack: 0.07,
    pexels: 0,
  }
  return costs[service] ?? 0
}
