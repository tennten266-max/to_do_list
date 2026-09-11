import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { normalizeSubtaskSteps, parseModelJson } from '@/lib/decompose'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはタスク分解の専門家です。親タスクの中の1つの曖昧・大きすぎる子タスクを、ユーザーがそのまま実行に移せる具体的な2〜5個の行動へ分解してください。

目的:
- 元の子タスクの単なる言い換えではなく、次に何をすればよいか迷わない行動にする
- 親タスクの title、summary、situation を使い、対象の文脈に合う内容にする

ルール:
- 親タスク、要約、質問回答履歴の主要言語を維持して action を書く。固有名詞や技術用語は原文の表記を維持してよい
- 入力に明示された事実だけを使う。場所、人物、ツール、サービス、ファイル名、保存先、デバイス、期限、回数、数量を推測・捏造しない
- 「title」と「situation」をユーザー由来の一次情報として優先する。「summary」は補助情報としてのみ使い、「title」または「situation」で裏付けられない場所、人物、ツール、数量、期限などの具体情報を、「summary」だけを根拠に事実として扱わない
- 親タスクと質問回答履歴から期限、頻度、回数、数量、対象、目的、完了条件を内部的に抽出して確認し、保持する。条件を勝手に変更したり、数量や回数を別の値へ置き換えたりしない。反復条件はactionに残す
- 各項目は原則1つの行動にする
- 巨大な作業は独立して完了判定できる自然な作業単位に分け、15分以内に収めようとしない
- 1つの子タスクは、1つのチェックボックスで完了・未完了を自然に判定できる1つの作業単位にする。複数の独立した作業を1件に詰め込まず、クリック1回やファイルを開く1回だけの過度に細かい分割も避ける
- minutes は各子タスクを実際に完了するための現実的な所要時間を、正の整数（分）で見積もる
- 「考える」「調べる」「確認する」「準備する」「やる」だけで終わる表現は禁止する。未指定の方法や環境を追加せず、実際の動作・対象・範囲・完了条件で具体化する
- 必要以上に細かくせず、元の子タスクを実行可能なまとまりに分ける
- 子タスク同士の内容を重複させない

出力前に自分で確認すること:
1. 各項目は元の子タスクより明確に具体化されているか
2. 各項目を読んだユーザーが、追加で考えずに次の行動を始められるか
3. 曖昧な動詞だけの項目、重複、順序の不自然さがないか
4. 2〜5個で、細かく分けすぎていないか
5. 親タスクと同じ主要言語で、入力にない具体情報を追加していないか
6. 親タスクの期限、頻度、回数、数量、対象、目的、完了条件を保持しているか
7. 各項目が1つのチェックボックスで完了・未完了を自然に判定できる1つの作業単位か
8. minutes が作業内容と整合した現実的な正の整数になっているか
基準を満たさない項目は書き直してから返してください。

説明文は出さず、次のJSONオブジェクトだけを返す
{"steps":[{"action":"対象・範囲・完了条件を含む具体的な行動","minutes":30}]}`

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: unknown
      summary?: unknown
      situation?: unknown
      subtask?: unknown
    } | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
    const situation = typeof body.situation === 'string' ? body.situation.trim() : ''
    const subtask = body.subtask && typeof body.subtask === 'object' ? body.subtask as Record<string, unknown> : null
    const action = subtask && typeof subtask.action === 'string' ? subtask.action.trim() : ''
    const minutes = subtask && typeof subtask.minutes === 'number' ? subtask.minutes : 0

    if (!title || !action || !Number.isFinite(minutes)) {
      return NextResponse.json({ error: '親タスクと再分解対象の子タスクが必要です' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY が設定されていません。.env.local を確認してください。' }, { status: 500 })
    }

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `親タスク: ${title}\n親タスクの要約: ${summary || 'なし'}\n質問回答履歴: ${situation || 'なし'}\n再分解対象: ${JSON.stringify({ action, minutes })}`,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: '再分解結果を取得できませんでした' }, { status: 502 })
    }

    return NextResponse.json(normalizeSubtaskSteps(parseModelJson(content)))
  } catch (error) {
    console.error('redecompose-subtask API error:', error)
    return NextResponse.json({ error: '子タスクの再分解に失敗しました' }, { status: 502 })
  }
}