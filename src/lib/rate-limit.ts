import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const AI_REQUEST_LIMIT = 30
const AI_WINDOW_SECONDS = 10 * 60

function getClientIp(request: Request): string | null {
  for (const headerName of ['x-forwarded-for', 'x-vercel-forwarded-for']) {
    const forwardedFor = request.headers.get(headerName)
    const ip = forwardedFor?.split(',')[0]?.trim()

    if (ip && isIP(ip)) return ip
  }

  return null
}

export async function enforceAIRateLimit(request: Request): Promise<NextResponse | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !secretKey) {
    console.error('AI rate limit is unavailable: Supabase server credentials are missing')
    return NextResponse.json({ error: 'AI APIを一時的に利用できません' }, { status: 503 })
  }

  const clientIp = getClientIp(request)
  if (!clientIp) {
    console.error('AI rate limit is unavailable: no valid client IP header was provided')
    return NextResponse.json({ error: 'AI APIを一時的に利用できません' }, { status: 503 })
  }

  const bucketKey = `ai:${createHash('sha256').update(clientIp).digest('hex')}`
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { data, error } = await supabase.rpc('consume_ai_rate_limit', {
      p_bucket_key: bucketKey,
      p_max_requests: AI_REQUEST_LIMIT,
      p_window_seconds: AI_WINDOW_SECONDS,
    })

    if (error || typeof data !== 'boolean') {
      console.error('AI rate limit check failed:', error?.message ?? 'Unexpected RPC response')
      return NextResponse.json({ error: 'AI APIを一時的に利用できません' }, { status: 503 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらく待ってから再度お試しください。' },
        { status: 429, headers: { 'Retry-After': String(AI_WINDOW_SECONDS) } },
      )
    }

    return null
  } catch (error) {
    console.error('AI rate limit check failed:', error)
    return NextResponse.json({ error: 'AI APIを一時的に利用できません' }, { status: 503 })
  }
}