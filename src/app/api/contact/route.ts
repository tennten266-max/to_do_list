import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_REQUEST_BYTES = 32 * 1024
const MAX_MESSAGE_LENGTH = 5000
const CONTACT_RATE_LIMIT = 5
const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1000
const MAX_RATE_LIMIT_BUCKETS = 10_000

type RateLimitBucket = {
  count: number
  resetAt: number
}

type LimitedBody =
  | { tooLarge: true }
  | { tooLarge: false; text: string }

const contactRateLimitBuckets = new Map<string, RateLimitBucket>()
let cleanupCounter = 0

function getClientIp(request: Request): string | null {
  for (const headerName of ['x-vercel-forwarded-for', 'x-forwarded-for', 'x-real-ip']) {
    const ip = request.headers.get(headerName)?.split(',')[0]?.trim()
    if (ip && isIP(ip)) return ip
  }

  return null
}

function enforceContactRateLimit(request: Request): NextResponse | null {
  const now = Date.now()
  cleanupCounter += 1

  if (cleanupCounter % 100 === 0 || contactRateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    for (const [key, bucket] of contactRateLimitBuckets) {
      if (bucket.resetAt <= now) contactRateLimitBuckets.delete(key)
    }
  }

  const clientIp = getClientIp(request) ?? 'unknown'
  const bucketKey = createHash('sha256').update(clientIp).digest('hex')
  const bucket = contactRateLimitBuckets.get(bucketKey)

  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && contactRateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
      return NextResponse.json(
        { error: 'ただいま送信を受け付けられません。時間をおいてから再度お試しください。' },
        { status: 503 },
      )
    }
    contactRateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + CONTACT_RATE_WINDOW_MS })
    return null
  }

  if (bucket.count >= CONTACT_RATE_LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    return NextResponse.json(
      { error: '送信回数が上限に達しました。しばらく時間をおいてから再度お試しください。' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  bucket.count += 1
  return null
}

async function readLimitedBody(request: Request): Promise<LimitedBody> {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return { tooLarge: true }
  }

  const reader = request.body?.getReader()
  if (!reader) return { tooLarge: false, text: '' }

  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel()
        return { tooLarge: true }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return { tooLarge: false, text: new TextDecoder().decode(body) }
}

function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(value)
}

function formatReceivedAt(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'long',
  }).format(date)
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 415 })
  }

  const limitedBody = await readLimitedBody(request)
  if (limitedBody.tooLarge) {
    return NextResponse.json({ error: '送信できるデータ量を超えています' }, { status: 413 })
  }

  const rateLimitResponse = enforceContactRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  let body: unknown
  try {
    body = JSON.parse(limitedBody.text)
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const values = body as Record<string, unknown>
  if (values.website !== undefined && typeof values.website !== 'string') {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  if (typeof values.website === 'string' && values.website.trim()) {
    return NextResponse.json({ error: '入力内容をご確認ください' }, { status: 400 })
  }

  if (typeof values.message !== 'string' || values.message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `お問い合わせ内容は1〜${MAX_MESSAGE_LENGTH}文字で入力してください` },
      { status: 400 },
    )
  }

  const message = values.message.trim()
  if (!message) {
    return NextResponse.json({ error: 'お問い合わせ内容を入力してください' }, { status: 400 })
  }

  if (values.contact !== undefined && typeof values.contact !== 'string') {
    return NextResponse.json({ error: '連絡先の形式が正しくありません' }, { status: 400 })
  }
  const contact = typeof values.contact === 'string' ? values.contact.trim() : ''
  if (contact && !isValidEmail(contact)) {
    return NextResponse.json({ error: '連絡先には有効なメールアドレスを入力してください' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const recipient = process.env.CONTACT_EMAIL
  const sender = process.env.CONTACT_FROM_EMAIL
  if (!apiKey || !recipient || !sender || !isValidEmail(recipient) || !isValidEmail(sender)) {
    console.error('Contact email configuration is incomplete or invalid')
    return NextResponse.json(
      { error: 'メール送信の設定が完了していません。時間をおいてから再度お試しください。' },
      { status: 503 },
    )
  }

  const emailText = [
    'お問い合わせ内容',
    '--------------------',
    message,
    '',
    '返信用の連絡先',
    contact || '入力されていません',
    '',
    `受信日時（日本時間）: ${formatReceivedAt(new Date())}`,
  ].join('\n')

  const email: {
    from: string
    to: string
    subject: string
    text: string
    reply_to?: string
  } = {
    from: sender,
    to: recipient,
    subject: 'ToDoアプリへのお問い合わせ',
    text: emailText,
  }
  if (contact) email.reply_to = contact

  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(email),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    console.error('Contact email provider request failed')
    return NextResponse.json(
      { error: 'メールを送信できませんでした。時間をおいてから、もう一度お試しください。' },
      { status: 502 },
    )
  }

  if (!response.ok) {
    console.error('Contact email provider rejected the request', response.status)
    return NextResponse.json(
      { error: 'メールを送信できませんでした。時間をおいてから、もう一度お試しください。' },
      { status: 502 },
    )
  }

  return NextResponse.json({ message: 'お問い合わせを送信しました' })
}
