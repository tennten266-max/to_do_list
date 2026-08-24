import type { Subtask } from '@/lib/decompose'

export type SituationOption = {
  id: string
  label: string
  hint: string
  todos: { action: string; minutes: number }[]
}

export const SITUATION_OPTIONS: SituationOption[] = [
  {
    id: 'lost',
    label: '何から始めればいいか分からない',
    hint: '就活の最初の一歩を決める',
    todos: [
      { action: '志望業界を「この1つ」に絞って紙に書く', minutes: 5 },
      { action: '気になる企業を3社、採用ページで開く', minutes: 10 },
      { action: '各社の募集職種と締切を1行ずつメモする', minutes: 10 },
      { action: '今日進める1社を決めて、ESか企業研究かを選ぶ', minutes: 5 },
    ],
  },
  {
    id: 'deadline',
    label: 'ESの提出が迫っている',
    hint: '締切前に下書きまで進める',
    todos: [
      { action: '提出するESの締切・文字数・提出方法を確認する', minutes: 5 },
      { action: '設問を1つ開き、「経験・学び・志望理由」を3点書く', minutes: 15 },
      { action: '3点を1文にまとめて下書きにする', minutes: 10 },
      { action: '誤字と文字数だけ直して下書きを保存する', minutes: 5 },
    ],
  },
  {
    id: 'interview',
    label: '面接・説明会の準備をしたい',
    hint: '話す内容を15分で整える',
    todos: [
      { action: '次の面接／説明会の日時と形式をカレンダーで確認する', minutes: 5 },
      { action: '自己紹介を60秒で声に出して1回言う', minutes: 10 },
      { action: '「なぜこの会社か」を3行で書く', minutes: 10 },
      { action: '逆質問を2つメモする', minutes: 5 },
    ],
  },
  {
    id: 'plan',
    label: '今週の就活計画だけ立てたい',
    hint: 'ES・企業研究・面接の配分を決める',
    todos: [
      { action: '今週の就活を「ES / 企業研究 / 面接」に分ける', minutes: 8 },
      { action: '今日15分で終わる作業を1つ選ぶ', minutes: 5 },
      { action: '残り2日分の作業をカレンダーに置く', minutes: 10 },
      { action: '完了条件を「提出・保存・予約」で1行書く', minutes: 5 },
    ],
  },
]

const VAGUE_KEYWORDS = ['就活', '就職', 'es', 'ｅｓ', 'エントリーシート', '勉強', '筋トレ']

export function isVagueTask(title: string) {
  const normalized = title.trim().toLowerCase()
  if (normalized.length <= 12) return true
  return VAGUE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

export function createSituationSubtasks(optionId: string): Subtask[] {
  const option = SITUATION_OPTIONS.find((item) => item.id === optionId) ?? SITUATION_OPTIONS[0]
  return option.todos.map((todo) => ({
    id: crypto.randomUUID(),
    action: todo.action,
    minutes: todo.minutes,
    done: false,
  }))
}

const STEP_TEMPLATES = [
  (title: string) => `「${title}」の完成イメージを1文でメモする`,
  (title: string) => `必要な材料・情報を3つだけ書き出す`,
  (title: string) => `最初の5分で着手できる最小アクションを決めて実行する`,
  (title: string) => `邪魔になりそうなものを机からどける`,
  (title: string) => `関連する資料またはタブを1つだけ開く`,
  (title: string) => `タイマーを15分にセットして作業を始める`,
  (title: string) => `途中経過を3行でメモして区切る`,
  (title: string) => `次にやる1手だけをカードの下に追記する`,
]

const MINUTES = [5, 8, 10, 12, 15]

export function createDummySubtasks(title: string): Subtask[] {
  const count = 3 + Math.floor(Math.random() * 3)
  const shuffled = [...STEP_TEMPLATES].sort(() => Math.random() - 0.5)

  return shuffled.slice(0, count).map((template, index) => ({
    id: crypto.randomUUID(),
    action: template(title),
    minutes: MINUTES[index % MINUTES.length],
    done: false,
  }))
}
