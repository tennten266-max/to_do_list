import { NextResponse } from 'next/server'

export function createAIProviderErrorResponse(error: unknown, operation: string): NextResponse {
  const candidate = error && typeof error === 'object'
    ? error as { name?: unknown; status?: unknown; code?: unknown }
    : {}
  const status = typeof candidate.status === 'number' ? candidate.status : null
  const errorCode = typeof candidate.code === 'string' && /^[a-z0-9_-]{1,64}$/i.test(candidate.code)
    ? candidate.code
    : 'unknown'

  console.error(`${operation} failed`, {
    errorType: error instanceof Error ? error.name : 'unknown',
    status,
    code: errorCode,
  })

  if (status === 401 || status === 403) {
    return NextResponse.json(
      { error: 'AIサービスの認証に失敗しました。管理者はGROQ_API_KEYを確認してください。' },
      { status: 502 },
    )
  }

  if (status === 429) {
    return NextResponse.json(
      { error: 'AIサービスの利用上限に達しました。しばらく待ってから再度お試しください。' },
      { status: 503 },
    )
  }

  if (status !== null && status >= 500) {
    return NextResponse.json(
      { error: 'AIサービスで一時的なエラーが発生しました。時間をおいてから再度お試しください。' },
      { status: 503 },
    )
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: 'AIの応答を読み取れませんでした。もう一度お試しください。' },
      { status: 502 },
    )
  }

  return NextResponse.json(
    { error: 'AI処理を完了できませんでした。モデル設定またはAIサービスの状態を確認してください。' },
    { status: 502 },
  )
}
