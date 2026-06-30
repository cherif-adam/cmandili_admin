import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-only admin client — bypasses RLS. Never import in client components.
//
// Lazy singleton: created on first use, not at module load time, so that
// Next.js static analysis at build time doesn't throw "supabaseUrl is required".
let _client: SupabaseClient | undefined

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return _client
}

export const supabaseAdmin: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  { get: (_target, prop: string | symbol) => (getClient() as any)[prop] }
)
