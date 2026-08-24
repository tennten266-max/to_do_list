import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { normalizeSteps, parseModelJson } from '@/lib/decompose'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはタスク分解の専門家です。入力された抽象的なタスクを、ユーザーが思考負荷なく即座に着手できるよう、15分以内で完了する極めて具体的な行動ステップ（3〜5個）に分解してください。

ルール:
- 各ステップは今すぐ実行できる具体的な行動にする（例: 「ESの設問を1つ開き、箇条書きで3点書く」）
- 各ステップの所要時間は1〜15分
- 抽象的な表現（「考える」「準備する」だけ）は禁止し、場所・対象・成果物を含める
- 説明文は出さず、次のJSONオブジェクトのみを返す:
{"steps":[{"action":"具体的な行動","minutes":10}]}`

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { task?: unknown }
    const task = typeof body.task === 'string' ? body.task.trim() : ''

    if (!task) {
      return NextResponse.json({ error: 'タスクを入力してください' }, { status: 400 })
    }

    const apiKey = process.env.XAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'XAI_API_KEY が設定されていません。.env.local を確認してください。' },
        { status: 500 },
      )
    }

    const xai = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
    })

    const completion = await xai.chat.completions.create({
      model: process.env.XAI_MODEL ?? 'grok-beta',
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: task },
      ],
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: '分解結果を取得できませんでした' }, { status: 502 })
    }

    const steps = normalizeSteps(parseModelJson(content))
    return NextResponse.json({ steps })
  } catch (error) {
    const message = error instanceof Error ? error.message : '分解に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
