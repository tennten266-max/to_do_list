import type { Metadata } from 'next'
import Link from 'next/link'
import ContactForm from '@/components/ContactForm'

export const metadata: Metadata = {
  title: '制作者へのお問い合わせ',
  description: 'ご意見・ご感想・不具合の報告などを制作者へ送信できます。',
}

export default function ContactPage() {
  return (
    <main className="mx-auto min-h-svh w-full max-w-2xl px-3 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <Link href="/" className="text-xs font-semibold tracking-[0.18em] text-orange-500 uppercase">
          ToDo
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
          制作者へのお問い合わせ
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          ご意見・ご感想・不具合の報告など、お気軽にお送りください。返信が必要な場合は、連絡先をご入力ください。
        </p>
      </header>

      <ContactForm />

      <footer className="mt-6 text-center text-sm">
        <Link href="/" className="font-medium text-orange-700 underline-offset-4 hover:underline">
          トップページへ戻る
        </Link>
      </footer>
    </main>
  )
}
