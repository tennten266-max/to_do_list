import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { normalizeSteps, parseModelJson } from '@/lib/decompose'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `あなたはタスク分解の専門家です。タスク名とユーザーの状況から、今すぐ実行できる具体的な行動を3〜5個作ってください。

ルール:
- タスク名とユーザーの状況・質問回答履歴の主要言語を判定し、子タスクの action も同じ主要言語で書く。固有名詞や技術用語は原文の表記を維持してよい
- 入力または質問回答履歴に明示された事実だけを使う。場所、人物、ツール、サービス、ファイル名、保存先、デバイス、期限、回数、数量を推測・捏造しない
- 未指定の情報がなくても、実際の動作、対象、作業範囲、完了条件で具体化する。存在しない場所やツールを前提にしない
- 分解前に、親タスクと質問回答履歴から期限、頻度、回数、数量、対象、目的、完了条件を内部的に抽出して確認する
- 抽出した重要条件を勝手に変更せず、数量や回数を別の数量へ置き換えない。特に「毎日」「毎週」などの反復条件を1回限りの条件へ変更せず、actionに保持する
- 分解後に、抽出した各条件が子タスクから消えていないか照合する
- 巨大な作業は、独立して完了判定できる自然な作業単位に分ける。15分以内に収める必要はない
- 1つの子タスクは、1つのチェックボックスで完了・未完了を自然に判定できる1つの作業単位にする。複数の独立した作業を1件に詰め込まず、クリック1回やファイルを開く1回だけの過度に細かい分割も避ける
- minutes は各子タスクを実際に完了するための現実的な所要時間を、正の整数（分）で見積もる。30分のレッスンを15分に短縮しない
- 抽象的な表現（「考える」「準備する」だけ）は禁止する
- 説明文は出さず、次のJSONオブジェクトだけを返す
{"steps":[{"action":"具体的な行動","minutes":30}]}`

const REVIEW_SYSTEM_PROMPT = `あなたはタスク分解結果のレビュアーです。親タスク、状況、子タスクを確認し、次の基準で評価してください。

評価基準:
- 各子タスクが具体的で、実際に行動できる内容か
- 「考える」「調べる」「やる」など曖昧すぎる表現だけになっていないか
- 子タスク同士で内容が重複していないか
- 粒度が極端にバラバラではないか
- 実行順序が自然か
- 親タスクの達成に必要な内容が大きく欠けていないか
- 子タスクが細かすぎたり多すぎたりしないか
- 子タスクが親タスクと状況・質問回答履歴の主要言語で書かれているか
- 入力にない場所、人物、ツール、サービス、ファイル名、保存先、デバイス、期限、回数、数量を根拠なく追加していないか
- 親タスクと状況に含まれる期限、頻度、回数、数量、対象、目的、完了条件が失われたり変更されたりしていないか
- 親タスクと状況から重要条件を内部的に抽出し、各条件が子タスクに反映されているか照合したか。反復条件を1回限りにしたり、数量・回数を別の値に置き換えたりしていないか
- 各子タスクが1つのチェックボックスで完了・未完了を自然に判定できる1つの作業単位か。独立した作業の詰め込みや過度な細分化がないか
- minutes が作業内容と整合した現実的な正の整数になっているか。15分に機械的に丸められていないか

説明文は出さず、次のJSONオブジェクトだけを返してください。問題がなければ issues は空配列にしてください。
{"isGood":true,"issues":[]}`

const REGENERATE_SYSTEM_PROMPT = `あなたはタスク分解の専門家です。親タスク、状況、元の分解結果、レビュー指摘をもとに、今すぐ実行できる具体的な子タスクを3〜5個に改善してください。

ルール:
- 親タスクと状況・質問回答履歴の主要言語を維持して action を書く。固有名詞や技術用語は原文の表記を維持してよい
- 入力または質問回答履歴に明示された事実だけを使い、場所、人物、ツール、サービス、ファイル名、保存先、デバイス、期限、回数、数量を推測・捏造しない
- 具体性は実際の動作、対象、作業範囲、完了条件で高め、未指定の環境や方法を勝手に追加しない
- 親タスクと質問回答履歴から期限、頻度、回数、数量、対象、目的、完了条件を内部的に抽出し、レビューで指摘された条件を含めて必ず保持する。条件を勝手に変更したり、数量や回数を別の値へ置き換えたりしない。反復条件はactionに残す
- 改善後に、抽出した各重要条件が子タスクから消えていないか照合する
- 巨大な作業は独立して完了判定できる自然な作業単位に分け、15分以内に収めようとしない
- 1つの子タスクは、1つのチェックボックスで完了・未完了を自然に判定できる1つの作業単位にする。複数の独立した作業を詰め込まず、クリック1回やファイルを開く1回だけの過度な細分化も避ける
- minutes は現実的な所要時間を正の整数（分）で見積もり、作業内容に対して不自然に15分へ丸めない
- 曖昧な表現、重複、極端に異なる粒度を避け、実行順序を自然にする
- 説明文は出さず、次のJSONオブジェクトだけを返す
{"steps":[{"action":"具体的な行動","minutes":30}]}`

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