'use client'

import { FormEvent, useState } from 'react'
import type { Subtask } from '@/lib/decompose'
import {
  SITUATION_OPTIONS,
  createDummySubtasks,
  createSituationSubtasks,
  isVagueTask,
  type SituationOption,
} from '@/lib/dummyTodos'

type ParentTask = {
  id: string
  title: string
  situation?: string
  subtasks: Subtask[]
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function SituationModal({
  onSelect,
  onClose,
}: {
  onSelect: (option: SituationOption) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-orange-950/30 backdrop-blur-sm"
        aria-label="閉じる"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="situation-title"
        className="relative w-full max-w-md rounded-3xl border border-orange-100 bg-white p-5 shadow-2xl sm:p-6"
      >
        <p className="text-xs font-semibold tracking-wide text-orange-500 uppercase">状況確認</p>
        <h2 id="situation-title" className="mt-1 text-xl font-semibold tracking-tight text-stone-800">
          今の状況を教えてください
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          やりたいことは「就活する」ですね。今の状況にいちばん近いものを選んでください。
        </p>
        <div className="mt-5 grid grid-cols-1 gap-2">
          {SITUATION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-left transition hover:border-orange-400 hover:bg-amber-50"
            >
              <span className="block font-semibold text-stone-800">{option.label}</span>
              <span className="mt-0.5 block text-xs text-stone-500">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ParentTaskCard({
  task,
  onToggle,
}: {
  task: ParentTask
  onToggle: (taskId: string, subtaskId: string) => void
}) {
  const doneCount = task.subtasks.filter((item) => item.done).length
  const total = task.subtasks.length
  const allDone = doneCount === total
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100)

  return (
    <article className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-orange-400 uppercase">親タスク</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-800">{task.title}</h2>
          {task.situation ? <p className="mt-1 text-sm text-stone-500">{task.situation}</p> : null}
        </div>
        <p
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
            allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          完了 {doneCount}/{total}
        </p>
      </header>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-orange-100">
        <div
          className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-500' : 'bg-orange-400'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {allDone ? (
        <p className="mb-4 rounded-2xl bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700">
          Task Completed!
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {task.subtasks.map((item) => (
          <li key={item.id}>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ${
                item.done
                  ? 'border-emerald-100 bg-emerald-50'
                  : 'border-orange-100 bg-orange-50/60 hover:border-orange-300'
              }`}
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggle(task.id, item.id)}
                className="mt-0.5 size-5 shrink-0 accent-emerald-600"
              />
              <span className="min-w-0 flex-1">
                <span className="mb-1 inline-flex rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                  {item.minutes}分
                </span>
                <span
                  className={`mt-1 block text-sm leading-6 ${
                    item.done ? 'text-emerald-700/70 line-through' : 'text-stone-800'
                  }`}
                >
                  {item.action}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </article>
  )
}

function TaskCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-orange-100 bg-white p-5 sm:p-6" aria-hidden>
      <div className="mb-5 flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-orange-100" />
          <div className="h-5 w-48 rounded bg-orange-100" />
        </div>
        <div className="h-7 w-20 rounded-full bg-amber-100" />
      </div>
      <div className="space-y-2">
        <div className="h-16 rounded-2xl bg-orange-50" />
        <div className="h-16 rounded-2xl bg-orange-50" />
        <div className="h-16 rounded-2xl bg-orange-50" />
      </div>
    </div>
  )
}

export default function TaskDecomposer() {
  const [draft, setDraft] = useState('就活する')
  const [pendingTitle, setPendingTitle] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [tasks, setTasks] = useState<ParentTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addTask(title: string, subtasks: Subtask[], situation?: string) {
    setTasks((current) => [
      {
        id: crypto.randomUUID(),
        title,
        situation,
        subtasks,
      },
      ...current,
    ])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.trim()
    if (!title) {
      setError('タスクを入力してください')
      return
    }
    if (loading) return

    setError('')

    if (isVagueTask(title)) {
      setPendingTitle(title)
      setModalOpen(true)
      return
    }

    setLoading(true)
    setDraft('')
    await wait(1000)
    addTask(title, createDummySubtasks(title))
    setLoading(false)
  }

  async function handleSelectSituation(option: SituationOption) {
    const title = pendingTitle || draft.trim() || '就活する'
    setModalOpen(false)
    setDraft('')
    setPendingTitle('')
    setLoading(true)
    await wait(400)
    addTask(title, createSituationSubtasks(option.id), option.label)
    setLoading(false)
  }

  function toggleSubtask(taskId: string, subtaskId: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks.map((item) =>
                item.id === subtaskId ? { ...item, done: !item.done } : item,
              ),
            }
          : task,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      <form
        onSubmit={handleSubmit}
        className="sticky top-0 z-10 rounded-3xl border border-orange-100 bg-white/90 p-4 shadow-sm backdrop-blur-md sm:p-5"
      >
        <label htmlFor="task" className="mb-2 block text-sm font-semibold text-stone-700">
          やりたいこと
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="task"
            type="text"
            value={draft}
            placeholder="例: 就活する"
            className="min-h-12 w-full rounded-2xl border border-orange-200 bg-orange-50/70 px-4 text-base text-stone-800 outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            onChange={(event) => {
              setDraft(event.target.value)
              if (error) setError('')
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                追加中
              </>
            ) : (
              '追加'
            )}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {loading ? <TaskCardSkeleton /> : null}

      {tasks.length === 0 && !loading ? (
        <p className="rounded-3xl border border-dashed border-orange-200 bg-white/70 px-5 py-10 text-center text-sm text-stone-500">
          「就活する」のまま追加すると、今の状況を4択で聞けます。
        </p>
      ) : null}

      {tasks.map((task) => (
        <ParentTaskCard key={task.id} task={task} onToggle={toggleSubtask} />
      ))}

      {modalOpen ? (
        <SituationModal onSelect={handleSelectSituation} onClose={() => setModalOpen(false)} />
      ) : null}
    </div>
  )
}
