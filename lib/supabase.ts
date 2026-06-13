import { createClient } from '@supabase/supabase-js'

// Browser-safe client — only uses NEXT_PUBLIC_ vars
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
