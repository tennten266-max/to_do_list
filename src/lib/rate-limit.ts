import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const AI_REQUEST_LIMIT = 30
const AI_WINDOW_SECONDS = 10 * 60
const AI_WINDOW_MS = AI_WINDOW_SECONDS * 1000
const developmentRateLimitBuckets = new Map<string, { count: number; resetAt: number }>()
let hasWarnedDevelopmentFallback = false

function getClientIp(request: Request): string | null {
  for (const headerName of ['x-vercel-forwarded-for', 'x-forwarded-for']) {
    const forwardedFor = request.headers.get(headerName)
    const ip = forwardedFor?.split(',')[0]?.trim()

    if (ip && isIP(ip)) return ip
  }

  if (process.env.NODE_ENV === 'development') return 'local-development'
  return null
}

function consumeDevelopmentRateLimit(bucketKey: string): boolean {
  const now = Date.now()
  for (const [key, bucket] of developmentRateLimitBuckets) {
    if (bucket.resetAt <= now) developmentRateLimitBuckets.delete(key)
  }

  const bucket = developmentRateLimitBuckets.get(bucketKey)
  if (!bucket || bucket.resetAt <= now) {
    developmentRateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + AI_WINDOW_MS })
    return true
  }

  if (bucket.count >= AI_REQUEST_LIMIT) return false
  bucket.count += 1
  return true
}

function applyDevelopmentRateLimit(bucketKey: string, reason: string): NextResponse | null {
  if (!hasWarnedDevelopmentFallback) {
    console.warn(`AI rate limit is using a process-local development limit: ${reason}`)
    hasWarnedDevelopmentFallback = true
  }

  if (consumeDevelopmentRateLimit(bucketKey)) return null

  return NextResponse.json(
    { error: 'リクエストが多すぎます。しばらく待ってから再度お試しください。' },
    { status: 429, headers: { 'Retry-After': String(AI_WINDOW_SECONDS) } },
  )
}

export async function enforceAIRateLimit(request: Request): Promise<NextResponse | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  const clientIp = getClientIp(request)
  if (!clientIp) {
    console.error('AI rate limit is unavailable: no valid client IP header was provided')
    return NextResponse.json(
      { error: 'リクエスト元を確認できないためAI APIを利用できません。管理者にお問い合わせください。' },
      { status: 503 },
    )
  }

  const bucketKey = `ai:${createHash('sha256').update(clientIp).digest('hex')}`
  if (!supabaseUrl || !secretKey) {
    if (process.env.NODE_ENV === 'development') {
      return applyDevelopmentRateLimit(bucketKey, 'Supabase server credentials are not configured')
    }

    console.error('AI rate limit is unavailable: Supabase server credentials are missing')
    const missingConfiguration = !supabaseUrl
      ? 'NEXT_PUBLIC_SUPABASE_URL'
      : 'SUPABASE_SECRET_KEY'
    return NextResponse.json(
      { error: `AI機能のサーバー設定が不足しています。管理者は環境変数 ${missingConfiguration} を設定してください。` },
      { status: 503 },
    )
  }

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
      console.error('AI rate limit RPC failed', { code: error?.code ?? 'unexpected_response' })
      if (process.env.NODE_ENV === 'development') {
        return applyDevelopmentRateLimit(bucketKey, 'Supabase rate limit RPC is unavailable')
      }
      return NextResponse.json(
        { error: 'AI機能のレート制限を確認できません。管理者はSupabaseの設定とマイグレーションを確認してください。' },
        { status: 503 },
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらく待ってから再度お試しください。' },
        { status: 429, headers: { 'Retry-After': String(AI_WINDOW_SECONDS) } },
      )
    }

    return null
  } catch (error) {
    console.error('AI rate limit request failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
    })
    if (process.env.NODE_ENV === 'development') {
      return applyDevelopmentRateLimit(bucketKey, 'Supabase rate limit request failed')
    }
    return NextResponse.json(
      { error: 'AI機能のレート制限を確認できません。時間をおいてから再度お試しください。' },
      { status: 503 },
    )
  }
}