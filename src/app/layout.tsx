import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: '15分タスク分解 ToDo',
  description: '抽象的なタスクを15分以内の具体的な行動に分解するToDoアプリ',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  )
}
