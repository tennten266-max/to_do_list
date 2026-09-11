import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { normalizeSteps, parseModelJson } from '@/lib/decompose'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはタスク分解の専門家です。入力された抽象的なタスクを、ユーザーが思考負荷なく即座に着手できるよう、具体的な行動ステップ（3〜5個）に分解してください。

ルール:
- 各ステップは今すぐ実行できる具体的な行動にする（例: 「ESの設問を1つ開き、箇条書きで3点書く」）
- 入力の主要言語を維持して action を書く。固有名詞や技術用語は原文の表記を維持してよい
- 入力にない場所、人物、ツール、サービス、ファイル名、保存先、デバイス、期限、回数、数量を推測・捏造しない
- 分解前に、入力から期限、頻度、回数、数量、対象、目的、完了条件を内部的に抽出して確認し、条件を変更せず保持する。数量や回数を別の値へ置き換えず、反復条件はactionに残す
- 巨大な作業は独立して完了判定できる自然な作業単位に分ける
- 1つの子タスクは、1つのチェックボックスで完了・未完了を自然に判定できる1つの作業単位にする。複数の独立した作業を詰め込まず、過度に細かくもしない
- minutes は現実的な所要時間を正の整数（分）で見積もる。15分へ丸めない
- 抽象的な表現（「考える」「準備する」だけ）は禁止し、動作・対象・範囲・完了条件で具体化する
- 説明文は出さず、次のJSONオブジェクトのみを返す:
{"steps":[{"action":"具体的な行動","minutes":30}]}`

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { task?: unknown }
    const task = typeof body.task === 'string' ? body.task.trim() : ''

    if (!task) {
      return NextResponse.json({ error: 'タスクを入力してください' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY が設定されていません。.env.local を確認してください。' },
        { status: 500 },
      )
    }

    const xai = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })

    const completion = await xai.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
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
