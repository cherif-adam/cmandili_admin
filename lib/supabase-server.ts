import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Call once per request in Server Components or Route Handlers.
// Uses the anon key + the user's session cookie for RLS-aware queries.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from a Server Component — cookies cannot be set
            // there. The middleware handles session refresh writes instead.
          }
        },
      },
    }
  )
}
