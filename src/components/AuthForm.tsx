'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AuthAction = 'magic-link' | 'signup' | 'password-login'
type AuthErrorInfo = { code?: string; status?: number }

function getAuthErrorMessage(error: AuthErrorInfo, action: AuthAction): string {
  if (error.status === 429 || error.code?.includes('rate_limit')) {
    return 'メール送信回数の上限に達しました。しばらく待ってから再度お試しください。'
  }

  if (error.code === 'email_not_confirmed') {
    return 'メールアドレスの確認が完了していません。確認メールのリンクを開いてください。'
  }

  if (error.code === 'invalid_credentials') {
    return 'メールアドレスまたはパスワードが正しくありません。'
  }

  if (error.code === 'email_address_invalid' || error.code === 'validation_failed') {
    return '入力内容を確認してください。メールアドレスの形式やパスワード要件をご確認ください。'
  }

  const actionName = action === 'signup' ? '新規登録' : action === 'magic-link' ? 'ログインリンクの送信' : 'ログイン'
  const errorCode = error.code ?? (error.status ? `HTTP ${error.status}` : '不明')
  return `${actionName}に失敗しました。Supabaseのメール認証・SMTP設定をご確認ください。（エラーコード: ${errorCode}）`
}

export default function AuthForm({ callbackError }: { callbackError: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingAction, setLoadingAction] = useState<AuthAction | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(callbackError)

  function clearStatus() {
    setMessage('')
    setError('')
  }

  function getCallbackUrl(): string {
    return new URL('/auth/callback', window.location.origin).toString()
  }

  function validateEmail(): boolean {
    return formRef.current?.querySelector<HTMLInputElement>('#email')?.reportValidity() ?? false
  }

  async function handleMagicLink() {
    if (!validateEmail()) return
    clearStatus()
    setLoadingAction('magic-link')

    try {
      const { error: authError } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: getCallbackUrl(),
          shouldCreateUser: false,
        },
      })

      if (authError) {
        setError(getAuthErrorMessage(authError, 'magic-link'))
        return
      }

      setMessage('ログインリンクの送信リクエストを受け付けました。登録済みのメールアドレスをご確認ください。メールが届かない場合は、迷惑メールとSupabaseのSMTP設定をご確認ください。')
    } catch {
      setError('ログインリンクを送信できませんでした。通信状況とSupabaseのメール設定をご確認のうえ、再度お試しください。')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleSignUp() {
    if (!password || password.length < 6) {
      setError('新規登録には6文字以上のパスワードを入力してください。')
      return
    }

    clearStatus()
    setLoadingAction('signup')

    try {
      const { data, error: authError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getCallbackUrl(),
        },
      })

      if (authError) {
        setError(getAuthErrorMessage(authError, 'signup'))
        return
      }

      if (!data.user || data.user.identities?.length === 0) {
        setError('登録を完了できませんでした。すでに登録済みの可能性があります。ログインリンクをお試しください。')
        return
      }

      if (data.session) {
        setMessage('登録が完了し、ログインしました。')
        router.replace('/')
        router.refresh()
        return
      }

      setPassword('')
      setMessage('登録リクエストを受け付けました。確認メールのリンクを開くと登録が完了します。メールが届かない場合は、迷惑メールとSupabaseのSMTP設定をご確認ください。')
    } catch {
      setError('新規登録に失敗しました。通信状況とSupabaseのメール設定をご確認のうえ、再度お試しください。')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handlePasswordLogin() {
    if (!password) {
      setError('パスワードを入力してください。')
      return
    }

    clearStatus()
    setLoadingAction('password-login')

    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(getAuthErrorMessage(authError, 'password-login'))
        return
      }

      router.replace('/')
      router.refresh()
    } catch {
      setError('ログインに失敗しました。通信状況をご確認のうえ、再度お試しください。')
    } finally {
      setLoadingAction(null)
    }
  }

  const isLoading = loadingAction !== null

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
        <p className="text-xs font-semibold tracking-[0.2em] text-orange-500 uppercase">Auth</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800">
          ログイン・新規登録
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          ログインリンクは登録済みの方向けです。初めて利用する場合は、パスワードを設定して新規登録してください。
        </p>

        <form
          ref={formRef}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            void handlePasswordLogin()
          }}
          className="mt-5 space-y-4"
        >
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearStatus()
              }}
              required
              disabled={isLoading}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-stone-800 outline-none transition focus:border-orange-400 disabled:opacity-60"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearStatus()
              }}
              maxLength={128}
              disabled={isLoading}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-stone-800 outline-none transition focus:border-orange-400 disabled:opacity-60"
              placeholder="新規登録時は6文字以上"
            />
            <p className="mt-1 text-xs text-stone-500">
              新規登録には6文字以上のパスワードが必要です。
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => void handleMagicLink()}
              disabled={isLoading || !email.trim()}
              className="w-full rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === 'magic-link' ? '送信中...' : 'マジックリンクを送る'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!validateEmail()) return
                if (password.length < 6) {
                  setError('パスワードを6文字以上で入力してください。')
                  return
                }
                void handlePasswordLogin()
              }}
              disabled={isLoading || !email.trim() || password.length < 6}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === 'password-login' ? 'ログイン中...' : 'パスワードでログイン'}
            </button>
          </div>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-xs text-stone-500">初めて利用する方</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <button
          type="button"
          onClick={() => {
            if (!validateEmail()) return
            void handleSignUp()
          }}
          disabled={isLoading || !email.trim() || password.length < 6}
          className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === 'signup' ? '登録中...' : '新規登録する'}
        </button>

        {message ? (
          <p role="status" aria-live="polite" className="mt-4 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-medium leading-6 text-emerald-700">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium leading-6 text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
        >
          ToDo画面に戻る
        </Link>
      </div>
    </main>
  )
}
