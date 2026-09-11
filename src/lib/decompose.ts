export type DecomposedStep = {
  action: string
  minutes: number
}

export type DecomposeResponse = {
  steps: DecomposedStep[]
}

export type Subtask = DecomposedStep & {
  id: string
  done: boolean
}

const MINUTES_MIN = 1
const MINUTES_MAX = 24 * 60
const STEPS_MIN = 3
const STEPS_MAX = 5

export function isDecomposedStep(value: unknown): value is DecomposedStep {
  if (!value || typeof value !== 'object') return false
  const step = value as Record<string, unknown>
  return typeof step.action === 'string' && step.action.trim().length > 0 && typeof step.minutes === 'number' && Number.isFinite(step.minutes)
}

export function parseModelJson(content: string): unknown {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  return JSON.parse(fenced ? fenced[1] : trimmed)
}

function normalizeStepsWithRange(raw: unknown, stepsMin: number, stepsMax: number): DecomposedStep[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? (raw as { steps?: unknown }).steps
      : undefined

  if (!Array.isArray(list)) {
    throw new Error('分解結果の形式が不正です')
  }

  const steps = list.filter(isDecomposedStep).map((step) => ({
    action: step.action.trim(),
    minutes: Math.min(MINUTES_MAX, Math.max(MINUTES_MIN, Math.round(step.minutes))),
  }))

  if (steps.length < stepsMin || steps.length > stepsMax) {
    throw new Error(`ステップ数は${stepsMin}〜${stepsMax}個である必要があります`)
  }

  return steps
}

export function normalizeSteps(raw: unknown): DecomposedStep[] {
  return normalizeStepsWithRange(raw, STEPS_MIN, STEPS_MAX)
}

export function normalizeSubtaskSteps(raw: unknown): DecomposedStep[] {
  return normalizeStepsWithRange(raw, 2, STEPS_MAX)
}
