import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { normalizeTaskAnalysis } from '@/lib/analyze'
import { parseModelJson } from '@/lib/decompose'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはタスク整理の専門家です。ユーザーのタスク名を読み、具体的な行動に落とし込むために状況確認が必要か判定してください。

ルール:
- 「就活する」「勉強する」のように目的だけで、最初の行動や対象が不明な場合は needsClarification を true にする
- 質問が必要な場合は、状況を最も分けられる1つの質問と、ちょうど4つの短い選択肢を作る
- 十分に具体的な場合は needsClarification を false にし、question と options は省略する
- 説明文は出さず、次のJSONオブジェクトだけを返す
質問が必要: {"needsClarification":true,"question":"質問文","options":["選択肢1","選択肢2","選択肢3","選択肢4"]}
質問不要: {"needsClarification":false}`

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { task?: unknown } | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
    }

    const task = typeof body.task === 'string' ? body.task.trim() : ''

    if (!task) {
      return NextResponse.json({ error: 'タスクを入力してください' }, { status: 400 })
    }

    const apiKey = process.env.XAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'XAI_API_KEY が設定されていません。.env.local を確認してください。' }, { status: 500 })
    }

    const xai = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' })
    const completion = await xai.chat.completions.create({
      model: process.env.XAI_MODEL ?? 'grok-2-1212',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: task },
      ],
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'タスク分析の結果を取得できませんでした' }, { status: 502 })
    }

    return NextResponse.json(normalizeTaskAnalysis(parseModelJson(content)))
  } catch {
    return NextResponse.json({ error: 'タスク分析に失敗しました' }, { status: 500 })
  }
}