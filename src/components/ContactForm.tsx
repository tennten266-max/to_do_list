'use client'

import { useState, type FormEvent } from 'react'

type SubmissionState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'success' }
  | { status: 'error'; message: string }

const MAX_MESSAGE_LENGTH = 5000

export default function ContactForm() {
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [submission, setSubmission] = useState<SubmissionState>({ status: 'idle' })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmission({ status: 'sending' })

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: contact.trim(), message: message.trim(), website }),
      })
      const data: unknown = await response.json()
      const errorMessage =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : '送信に失敗しました。時間をおいてから、もう一度お試しください。'

      if (!response.ok) {
        setSubmission({ status: 'error', message: errorMessage })
        return
      }

      setContact('')
      setMessage('')
      setWebsite('')
      setSubmission({ status: 'success' })
    } catch {
      setSubmission({
        status: 'error',
        message: '送信に失敗しました。通信状況をご確認のうえ、もう一度お試しください。',
      })
    }
  }

  const isSending = submission.status === 'sending'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <label htmlFor="contact" className="mb-1.5 block text-sm font-semibold text-stone-700">
          返信が必要な場合の連絡先（任意）
        </label>
        <input
          id="contact"
          name="contact"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={contact}
          onChange={(event) => {
            setContact(event.target.value)
            setSubmission({ status: 'idle' })
          }}
          disabled={isSending}
          placeholder="メールアドレスなど（任意）"
          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-800 outline-none transition focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200 disabled:opacity-60"
        />
        <p className="mt-1.5 text-xs text-stone-500">メールアドレスをご入力いただくと、返信時に利用します。</p>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-stone-700">
          お問い合わせ内容 <span className="text-red-600">（必須）</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          maxLength={MAX_MESSAGE_LENGTH}
          rows={8}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
            setSubmission({ status: 'idle' })
          }}
          disabled={isSending}
          placeholder="ご意見・ご感想・お問い合わせ内容をご記入ください"
          className="w-full resize-y rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm leading-6 text-stone-800 outline-none transition focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200 disabled:opacity-60"
        />
        <p className="mt-1.5 text-right text-xs text-stone-500" aria-live="polite">
          {message.length.toLocaleString('ja-JP')} / {MAX_MESSAGE_LENGTH.toLocaleString('ja-JP')}文字
        </p>
      </div>

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="website">ウェブサイト</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      {submission.status === 'success' ? (
        <p role="status" aria-live="polite" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          お問い合わせを送信しました
        </p>
      ) : null}
      {submission.status === 'error' ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submission.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSending || !message.trim()}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSending ? '送信中...' : '送信する'}
      </button>
    </form>
  )
}
