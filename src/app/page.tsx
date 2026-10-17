'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import TaskDecomposer from '@/components/TaskDecomposer'

export default function HomePage() {
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    const supabase = createClient()

    const syncAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsLoggedIn(Boolean(session?.user))
      setUserEmail(session?.user?.email ?? '')
    }

    void syncAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user))
      setUserEmail(session?.user?.email ?? '')
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!logoutDialogOpen) return

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isLoggingOut) setLogoutDialogOpen(false)
    }

    window.addEventListener('keydown', handleDialogKeyDown)
    return () => window.removeEventListener('keydown', handleDialogKeyDown)
  }, [logoutDialogOpen, isLoggingOut])

  function handleAuthAction() {
    if (isLoggedIn) {
      setLogoutError('')
      setLogoutDialogOpen(true)
      return
    }

    router.push('/auth')
  }

  async function confirmLogout() {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    setLogoutError('')
    try {
      const { error } = await createClient().auth.signOut()
      if (error) {
        setLogoutError('ログアウトに失敗しました。通信状況をご確認のうえ、もう一度お試しください。')
        return
      }

      setIsLoggedIn(false)
      setUserEmail('')
      setLogoutDialogOpen(false)
    } catch {
      setLogoutError('ログアウトに失敗しました。通信状況をご確認のうえ、もう一度お試しください。')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-2xl px-3 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold tracking-[0.18em] text-orange-500 uppercase">ToDo</p>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
            >
              使い方
            </button>
            <Link
              href="/contact"
              className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
            >
              お問い合わせ
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
            to doを細分化する
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            「就活する」のようにアバウトな入力と、質問への回答から具体的なToDoに分けます。
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          <p className="text-xs font-semibold text-stone-600">
            {isLoggedIn ? `ログイン中（Supabase に保存）: ${userEmail}` : 'ゲスト利用中（端末にのみ保存）'}
          </p>
          <button
            type="button"
            onClick={handleAuthAction}
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
          >
            {isLoggedIn ? 'ログアウトする' : '複数端末で同期するにはログイン'}
          </button>
        </div>
      </header>

      <TaskDecomposer />

      {helpOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="使い方を閉じる"
            className="absolute inset-0 bg-stone-950/30 backdrop-blur-sm"
            onClick={() => setHelpOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            className="relative w-full max-w-lg rounded-3xl border border-orange-100 bg-white p-5 shadow-2xl sm:p-6"
          >
            <p className="text-xs font-semibold tracking-[0.18em] text-orange-500 uppercase">使い方</p>
            <h2 id="help-title" className="mt-1 text-xl font-semibold tracking-tight text-stone-800">
              その「やりたいこと」を、すぐに実行できるToDoに変えます
            </h2>

            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-stone-600">
              <li>やりたいことを一言で入力して「追加」を押します。</li>
              <li>曖昧なタスクは、状況に近い選択肢を4つから選びます。</li>
              <li>細分化された各作業を見て、進捗と完了を管理します。</li>
              <li>ゲスト利用では端末内に保存されます。複数端末同期はログイン後に利用できます。</li>
            </ol>

            <div className="mt-5 rounded-2xl bg-orange-50 p-4 text-sm text-stone-600">
              例: 「就活する」→ 「履歴書を整える」「面接対策をする」などの具体的な行動に分解されます。
            </div>

            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}

      {logoutDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="ログアウト確認を閉じる"
            className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm"
            disabled={isLoggingOut}
            onClick={() => setLogoutDialogOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            className="relative w-full max-w-sm rounded-3xl border border-orange-100 bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id="logout-title" className="text-xl font-semibold tracking-tight text-stone-800">
              ログアウトしますか？
            </h2>
            <p id="logout-description" className="mt-2 text-sm leading-6 text-stone-600">
              ログアウトしてもよろしいですか？
            </p>
            {logoutError ? (
              <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {logoutError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                disabled={isLoggingOut}
                onClick={() => setLogoutDialogOpen(false)}
                className="min-h-11 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => void confirmLogout()}
                className="min-h-11 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
