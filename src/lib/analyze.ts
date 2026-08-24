export type TaskAnalysis = {
  needsClarification: boolean
  question?: string
  options?: string[]
}

export function normalizeTaskAnalysis(raw: unknown): TaskAnalysis {
  if (!raw || typeof raw !== 'object') {
    throw new Error('分析結果の形式が不正です')
  }

  const analysis = raw as Record<string, unknown>
  if (typeof analysis.needsClarification !== 'boolean') {
    throw new Error('質問要否の形式が不正です')
  }

  if (!analysis.needsClarification) {
    return { needsClarification: false }
  }

  const question = typeof analysis.question === 'string' ? analysis.question.trim() : ''
  const options = Array.isArray(analysis.options)
    ? analysis.options.filter((option): option is string => typeof option === 'string').map((option) => option.trim()).filter(Boolean)
    : []

  if (!question || options.length !== 4) {
    throw new Error('質問と4つの選択肢が必要です')
  }

  return { needsClarification: true, question, options }
}