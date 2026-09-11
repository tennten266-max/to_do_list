import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { normalizeSubtaskSteps, parseModelJson } from '@/lib/decompose'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはタスク分解の専門家です。親タスクの中の1つの曖昧・大きすぎる子タスクを、ユーザーがそのまま実行に移せる具体的な2〜5個の行動へ分解してください。

目的:
- 元の子タスクの単なる言い換えではなく、次に何をすればよいか迷わない行動にする
- 親タスクの title、summary、situation を使い、対象の文脈に合う内容にする

ルール:
- 各項目は原則1つの行動にする
- 各ステップは15分以内で完了する範囲にし、実行順序で並べる
- 可能な限り「何を」「どこで」「どの程度まで」「何を成果物として残すか」を含める
- 「考える」「調べる」「確認する」「準備する」「やる」だけで終わる表現は禁止する。必ず対象・方法・範囲・成果物のいずれかを具体化する
- 「企業研究をする」なら「公式サイトで事業内容を確認する」「採用ページから求める人物像を3点メモする」のように、対象と完了条件を書く
- 必要以上に細かくせず、元の子タスクを実行可能なまとまりに分ける
- 子タスク同士の内容を重複させない

出力前に自分で確認すること:
1. 各項目は元の子タスクより明確に具体化されているか
2. 各項目を読んだユーザーが、追加で考えずに次の行動を始められるか
3. 曖昧な動詞だけの項目、重複、順序の不自然さがないか
4. 2〜5個で、細かく分けすぎていないか
基準を満たさない項目は書き直してから返してください。

説明文は出さず、次のJSONオブジェクトだけを返す
{"steps":[{"action":"対象・方法・完了条件を含む具体的な行動","minutes":10}]}`

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