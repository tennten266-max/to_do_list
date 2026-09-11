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

const REVIEW_SYSTEM_PROMPT = `あなたはタスク分解結果のレビュアーです。親タスク、状況、子タスクを確認し、次の基準で評価してください。

評価基準:
- 各子タスクが具体的で、実際に行動できる内容か
- 「考える」「調べる」「やる」など曖昧すぎる表現だけになっていないか
- 子タスク同士で内容が重複していないか
- 粒度が極端にバラバラではないか
- 実行順序が自然か
- 親タスクの達成に必要な内容が大きく欠けていないか
- 子タスクが細かすぎたり多すぎたりしないか

説明文は出さず、次のJSONオブジェクトだけを返してください。問題がなければ issues は空配列にしてください。
{"isGood":true,"issues":[]}`

const REGENERATE_SYSTEM_PROMPT = `あなたはタスク分解の専門家です。親タスク、状況、元の分解結果、レビュー指摘をもとに、今すぐ実行できる具体的な子タスクを3〜5個に改善してください。

ルール:
- 各ステップは15分以内で完了し、場所・対象・成果物を含む具体的な行動にする
- 各ステップの minutes は1〜15の整数にする
- 曖昧な表現、重複、極端に異なる粒度を避け、実行順序を自然にする
- 説明文は出さず、次のJSONオブジェクトだけを返す
{"steps":[{"action":"具体的な行動","minutes":10}]}`

type DecompositionReview = {
  isGood: boolean
  issues: string[]
}

function normalizeReview(raw: unknown): DecompositionReview {
  if (!raw || typeof raw !== 'object') {
    throw new Error('評価結果の形式が不正です')
  }

  const review = raw as Record<string, unknown>
  if (typeof review.isGood !== 'boolean' || !Array.isArray(review.issues)) {
    throw new Error('評価結果の形式が不正です')
  }

  const issues = review.issues.filter((issue): issue is string => typeof issue === 'string').map((issue) => issue.trim()).filter(Boolean)
  return { isGood: review.isGood, issues }
}

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

    const initialSteps = normalizeSteps(parseModelJson(content))

    try {
      const reviewCompletion = await client.chat.completions.create({
        model: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
        temperature: 0.1,
        messages: [
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `親タスク: ${task}\n状況・質問回答履歴: ${answer || 'なし'}\n子タスク: ${JSON.stringify(initialSteps)}`,
          },
        ],
        response_format: { type: 'json_object' },
      })
      const reviewContent = reviewCompletion.choices[0]?.message?.content
      if (!reviewContent) return NextResponse.json(initialSteps)

      const review = normalizeReview(parseModelJson(reviewContent))
      if (review.isGood) return NextResponse.json(initialSteps)

      try {
        const regenerateCompletion = await client.chat.completions.create({
          model: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
          temperature: 0.4,
          messages: [
            { role: 'system', content: REGENERATE_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `親タスク: ${task}\n状況・質問回答履歴: ${answer || 'なし'}\n最初の分解結果: ${JSON.stringify(initialSteps)}\nレビュー指摘: ${JSON.stringify(review.issues)}`,
            },
          ],
          response_format: { type: 'json_object' },
        })
        const regenerateContent = regenerateCompletion.choices[0]?.message?.content
        if (!regenerateContent) return NextResponse.json(initialSteps)

        return NextResponse.json(normalizeSteps(parseModelJson(regenerateContent)))
      } catch (error) {
        console.error('decompose-task regeneration error:', error)
        return NextResponse.json(initialSteps)
      }
    } catch (error) {
      console.error('decompose-task review error:', error)
      return NextResponse.json(initialSteps)
    }
  } catch (error) {
    console.error('decompose-task API error:', error)
    return NextResponse.json({ error: 'AI APIへの接続またはタスク分解に失敗しました。.env.local のキーとモデル設定を確認してください。' }, { status: 502 })
  }
}