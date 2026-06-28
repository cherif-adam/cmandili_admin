import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(_req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', _req.url))
}
