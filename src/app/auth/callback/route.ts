import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function redirectToAuth(requestUrl: URL, status: string) {
  const authUrl = new URL('/auth', requestUrl.origin)
  authUrl.searchParams.set('auth', status)
  return NextResponse.redirect(authUrl)
}

function getFailureStatus(code: string | undefined): string {
  if (code === 'otp_expired' || code === 'flow_state_expired' || code === 'flow_state_not_found') {
    return 'expired'
  }
  if (code === 'bad_code_verifier' || code === 'invalid_grant') return 'invalid'
  return 'failed'
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const providerError = requestUrl.searchParams.get('error_code')
  if (providerError || requestUrl.searchParams.has('error')) {
    return redirectToAuth(requestUrl, getFailureStatus(providerError ?? undefined))
  }

  const code = requestUrl.searchParams.get('code')
  if (!code) return redirectToAuth(requestUrl, 'invalid')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return redirectToAuth(requestUrl, 'configuration')

  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) {
    return redirectToAuth(requestUrl, getFailureStatus(error?.code))
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
