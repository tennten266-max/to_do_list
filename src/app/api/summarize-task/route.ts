import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはタスク整理の専門家です。元のタスクと質問・回答履歴をもとに、親タスクとして表示する自然な日本語の要約を1文だけ作ってください。

ルール:
- 質問1、回答1などのラベルは使わない
- 長すぎない、具体的で自然な1文にする
- 説明や箇条書きは出さず、要約文だけを返す
- 履歴から分かる範囲で、目的・対象・条件・頻度などを含める`

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { task?: unknown; history?: unknown } | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
    }

    const task = typeof body.task === 'string' ? body.task.trim() : ''
    const history = typeof body.history === 'string' ? body.history.trim() : ''

    if (!task || !history) {
      return NextResponse.json({ error: 'タスクと質問・回答履歴が必要です' }, { status: 400 })
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
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `元のタスク: ${task}\n質問・回答履歴:\n${history}` },
      ],
    })

    const summary = completion.choices[0]?.message?.content?.trim()
    if (!summary) {
      return NextResponse.json({ error: '要約を取得できませんでした' }, { status: 502 })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('summarize-task API error:', error)
    return NextResponse.json({ error: 'タスク要約に失敗しました' }, { status: 502 })
  }
}
