import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { normalizeSteps, parseModelJson } from '@/lib/decompose'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはタスク分解の専門家です。タスク名とユーザーの状況から、今すぐ実行できる具体的な行動を3〜5個作ってください。

ルール:
- 各ステップは15分以内で完了し、場所・対象・成果物を含む具体的な行動にする
- 各ステップの minutes は1〜15の整数にする
- 抽象的な表現（「考える」「準備する」だけ）は禁止する
- 説明文は出さず、次のJSONオブジェクトだけを返す
{"steps":[{"action":"具体的な行動","minutes":10}]}`

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { task?: unknown; answer?: unknown } | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
    }

    const task = typeof body.task === 'string' ? body.task.trim() : ''
    if (body.answer !== undefined && typeof body.answer !== 'string') {
      return NextResponse.json({ error: '回答の形式が不正です' }, { status: 400 })
    }

    const answer = typeof body.answer === 'string' ? body.answer.trim() : ''

    if (!task) {
      return NextResponse.json({ error: 'タスクを入力してください' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY が設定されていません。.env.local を確認してください。' }, { status: 500 })
    }

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
    const userPrompt = answer ? `タスク: ${task}\nユーザーの状況: ${answer}` : `タスク: ${task}`
    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: '分解結果を取得できませんでした' }, { status: 502 })
    }

    return NextResponse.json(normalizeSteps(parseModelJson(content)))
  } catch (error) {
    console.error('decompose-task API error:', error)
    return NextResponse.json({ error: 'AI APIへの接続またはタスク分解に失敗しました。.env.local のキーとモデル設定を確認してください。' }, { status: 502 })
  }
}