import { supabaseAdmin } from './supabase-admin'
import { createSupabaseServerClient } from './supabase-server'
import type { User } from '@supabase/supabase-js'

export interface AuditEntry {
  admin_id: string | null
  admin_email: string
  action_type: string
  target_type?: string
  target_id?: string
  details?: Record<string, unknown>
}

// Awaited but errors are silently swallowed — logging never blocks the response.
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      admin_id:    entry.admin_id ?? null,
      admin_email: entry.admin_email,
      action_type: entry.action_type,
      target_type: entry.target_type ?? null,
      target_id:   entry.target_id   ?? null,
      details:     entry.details     ?? null,
    })
  } catch {
    // Best-effort — never throw
  }
}

// For routes that don't already resolve the session (toggle-ghost, menu routes).
export async function getSessionUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}
