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

// Authorization gate for service-role API routes. Returns the admin User only
// if the request carries a valid session whose profile has is_admin = true;
// otherwise null. Routes MUST reject (403) on null — the service-role client
// bypasses RLS, so this is the only access control on those endpoints.
//
// getUser() verifies the token against Supabase Auth (not the spoofable
// getSession()); the is_admin lookup uses the service-role client so RLS on
// profiles can't hide the flag.
export async function requireAdmin(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    return profile?.is_admin ? user : null
  } catch {
    return null
  }
}
