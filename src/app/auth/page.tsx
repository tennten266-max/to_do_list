import AuthForm from '@/components/AuthForm'

const CALLBACK_MESSAGES: Record<string, string> = {
  expired: '認証リンクの有効期限が切れているか、すでに使用されています。新しいリンクをリクエストしてください。',
  invalid: '認証リンクを確認できませんでした。新しいリンクをリクエストしてください。',
  configuration: '認証を完了できませんでした。時間をおいてから再度お試しください。',
  failed: '認証リンクの処理に失敗しました。新しいリンクをリクエストしてください。',
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>
}) {
  const { auth } = await searchParams
  const callbackError = auth
    ? CALLBACK_MESSAGES[auth] ?? CALLBACK_MESSAGES.failed
    : ''

  return <AuthForm callbackError={callbackError} />
}
