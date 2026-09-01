'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DecomposedStep, Subtask } from '@/lib/decompose'
import type { TaskAnalysis } from '@/lib/analyze'

const GUEST_TASKS_KEY = 'todo-decomposer-guest-tasks'

type ParentTask = {
  id: string
  title: string
  situation?: string
  subtasks: Subtask[]
}

function serializeTaskForDb(task: ParentTask) {
  return JSON.stringify({
    title: task.title,
    situation: task.situation ?? null,
    subtasks: task.subtasks,
  })
}

function parseTaskFromDbTitle(rawTitle: string): { title: string; situation?: string; subtasks: Subtask[] } {
  try {
    const parsed = JSON.parse(rawTitle) as {
      title?: string
      situation?: string | null
      subtasks?: Subtask[]
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.subtasks)) {
      return {
        title: typeof parsed.title === 'string' ? parsed.title : rawTitle,
        situation: typeof parsed.situation === 'string' ? parsed.situation : undefined,
        subtasks: parsed.subtasks,
      }
    }
  } catch {
    // plain text title, fall through below
  }

  return {
    title: rawTitle,
    subtasks: [
      {
        id: crypto.randomUUID(),
        action: rawTitle,
        minutes: 15,
        done: false,
      },
    ],
  }
}

function SituationModal({
  task,
  analysis,
  onSelect,
  onClose,
}: {
  task: string
  analysis: TaskAnalysis
  onSelect: (answer: string) => void
  onClose: () => void
}) {
  if (!analysis.needsClarification || !analysis.question || !analysis.options) return null

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
          {analysis.question}
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          「{task}」について、いちばん近い状況を選んでください。
        </p>
        <div className="mt-5 grid grid-cols-1 gap-2">
          {analysis.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-left transition hover:border-orange-400 hover:bg-amber-50"
            >
              <span className="block font-semibold text-stone-800">{option}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T | { error?: unknown }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : '通信に失敗しました'
    throw new Error(message)
  }
  return data as T
}

function ParentTaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: ParentTask
  onToggle: (taskId: string, subtaskId: string) => void
  onDelete: (taskId: string) => void
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
        <div className="flex shrink-0 items-center gap-2">
          <p
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            完了 {doneCount}/{total}
          </p>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:border-red-200 hover:text-red-600"
          >
            削除
          </button>
        </div>
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
  const [draft, setDraft] = useState('')
  const [pendingTitle, setPendingTitle] = useState('')
  const [analysis, setAnalysis] = useState<TaskAnalysis | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [tasks, setTasks] = useState<ParentTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const isAuthenticated = Boolean(userId)

  function readLocalTasks(): ParentTask[] {
    if (typeof window === 'undefined') return []

    try {
      const savedTasks = window.localStorage.getItem(GUEST_TASKS_KEY)
      if (!savedTasks) return []

      const parsedTasks = JSON.parse(savedTasks) as ParentTask[]
      return Array.isArray(parsedTasks) ? parsedTasks : []
    } catch {
      window.localStorage.removeItem(GUEST_TASKS_KEY)
      return []
    }
  }

  function persistLocalTasks(nextTasks: ParentTask[]) {
    if (typeof window === 'undefined') return

    try {
      if (nextTasks.length === 0) {
        window.localStorage.removeItem(GUEST_TASKS_KEY)
        return
      }

      window.localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(nextTasks))
    } catch {
      // 端末の保存制限により、保存に失敗した場合は無視する
    }
  }

  async function loadSupabaseTasks(currentUserId: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    console.log('loadSupabaseTasks', { currentUserId, count: data?.length ?? 0, error: error?.message ?? null })

    if (error) {
      setError('データの読み込みに失敗しました')
      return
    }

    const mappedTasks = (data ?? []).map((row) => {
      const parsed = parseTaskFromDbTitle(row.title)
      return {
        id: row.id,
        title: parsed.title,
        situation: parsed.situation,
        subtasks: parsed.subtasks.map((subtask) => ({
          ...subtask,
          id: subtask.id || row.id,
          done: Boolean(row.is_completed) ? Boolean(subtask.done) : subtask.done,
        })),
      }
    })

    setTasks(mappedTasks)
    persistLocalTasks([])
  }

  async function syncGuestTasksToSupabase(currentUserId: string) {
    const localTasks = readLocalTasks()
    console.log('syncGuestTasksToSupabase start', {
      currentUserId,
      localTaskCount: localTasks.length,
      hasLocalData: localTasks.length > 0,
    })

    if (localTasks.length === 0) {
      await loadSupabaseTasks(currentUserId)
      return
    }

    const supabase = createClient()
    const rows = localTasks.map((task) => ({
      id: task.id,
      title: serializeTaskForDb(task),
      user_id: currentUserId,
      is_completed: task.subtasks.length > 0 && task.subtasks.every((item) => item.done),
    }))

    const { data, error } = await supabase.from('todos').upsert(rows)
    console.log('syncGuestTasksToSupabase result', { rowsCount: rows.length, data, error: error?.message ?? null })

    if (error) {
      setError('ゲストデータの同期に失敗しました')
      return
    }

    persistLocalTasks([])
    await loadSupabaseTasks(currentUserId)
  }

  useEffect(() => {
    const supabase = createClient()

    const syncAuthState = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      console.log('getSession result', {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        error: error?.message ?? null,
      })

      if (session?.user) {
        setUserId(session.user.id)
        setAuthReady(true)
        await loadSupabaseTasks(session.user.id)
        return
      }

      setUserId(null)
      setAuthReady(true)
      setTasks(readLocalTasks())
    }

    void syncAuthState()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('onAuthStateChange fired', {
        event,
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
      })

      if (session?.user) {
        setUserId(session.user.id)
        setAuthReady(true)
        await syncGuestTasksToSupabase(session.user.id)
        return
      }

      setUserId(null)
      setAuthReady(true)
      setTasks(readLocalTasks())
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authReady) return

    if (!isAuthenticated) {
      persistLocalTasks(tasks)
      return
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(GUEST_TASKS_KEY)
    }
  }, [tasks, authReady, isAuthenticated])

  function addTask(title: string, steps: DecomposedStep[], situation?: string) {
    const nextTask: ParentTask = {
      id: crypto.randomUUID(),
      title,
      situation,
      subtasks: steps.map((step) => ({ ...step, id: crypto.randomUUID(), done: false })),
    }

    const nextTasks = [nextTask, ...tasks]
    setTasks(nextTasks)

    console.log('addTask called', {
      isAuthenticated,
      userId,
      title,
      taskId: nextTask.id,
      subtaskCount: nextTask.subtasks.length,
    })

    if (isAuthenticated && userId) {
      const supabase = createClient()
      void supabase
        .from('todos')
        .insert({
          id: nextTask.id,
          user_id: userId,
          title: serializeTaskForDb(nextTask),
          is_completed: false,
        })
        .then(({ error }) => {
          console.log('insert todo result', {
            taskId: nextTask.id,
            error: error?.message ?? null,
          })
        })
    } else {
      persistLocalTasks(nextTasks)
    }
  }

  async function decomposeTask(title: string, answer?: string) {
    const response = await fetch('/api/decompose-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: title, ...(answer ? { answer } : {}) }),
    })
    const steps = await readApiResponse<DecomposedStep[]>(response)
    addTask(title, steps, answer)
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
    setLoading(true)
    setDraft('')
    try {
      const response = await fetch('/api/analyze-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: title }),
      })
      const result = await readApiResponse<TaskAnalysis>(response)
      if (result.needsClarification) {
        setPendingTitle(title)
        setAnalysis(result)
        setModalOpen(true)
        setLoading(false)
        return
      }
      await decomposeTask(title)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'タスクの追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectSituation(answer: string) {
    const title = pendingTitle
    setModalOpen(false)
    setAnalysis(null)
    setDraft('')
    setPendingTitle('')
    setLoading(true)
    setError('')
    try {
      await decomposeTask(title, answer)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'タスクの追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function toggleSubtask(taskId: string, subtaskId: string) {
    let nextDoneValue = false

    const nextTasks = tasks.map((task) => {
      if (task.id !== taskId) return task

      const nextSubtasks = task.subtasks.map((item) =>
        item.id === subtaskId ? { ...item, done: !item.done } : item,
      )

      nextDoneValue = nextSubtasks.every((item) => item.done)

      return {
        ...task,
        subtasks: nextSubtasks,
      }
    })

    setTasks(nextTasks)
    console.log('toggleSubtask called', {
      isAuthenticated,
      userId,
      taskId,
      subtaskId,
      nextDoneValue,
    })

    if (isAuthenticated && userId) {
      const supabase = createClient()
      const currentTask = tasks.find((task) => task.id === taskId)
      if (!currentTask) {
        return
      }

      const updatedTask: ParentTask = {
        ...currentTask,
        subtasks: currentTask.subtasks.map((item) =>
          item.id === subtaskId ? { ...item, done: !item.done } : item,
        ),
      }

      void supabase
        .from('todos')
        .update({
          title: serializeTaskForDb(updatedTask),
          is_completed: updatedTask.subtasks.length > 0 && updatedTask.subtasks.every((item) => item.done),
        })
        .eq('id', taskId)
        .then(({ error }) => {
          console.log('update todo result', {
            taskId,
            nextDoneValue,
            error: error?.message ?? null,
          })
        })
    } else {
      persistLocalTasks(nextTasks)
    }
  }

  async function deleteTask(taskId: string) {
    const nextTasks = tasks.filter((task) => task.id !== taskId)
    setTasks(nextTasks)
    console.log('deleteTask called', { isAuthenticated, userId, taskId })

    if (!isAuthenticated || !userId) {
      persistLocalTasks(nextTasks)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('todos').delete().eq('id', taskId)
    console.log('delete todo result', { taskId, error: error?.message ?? null })
    if (error) {
      setError('削除に失敗しました')
    }
  }

  useEffect(() => {
    if (tasks.length > 0 && draft === '') {
      setDraft('')
    }
  }, [tasks.length, draft])

  return (
    <div className="flex flex-col gap-4 pb-16">
      <div className="rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">
        {isAuthenticated ? 'ログイン済み（Supabase に保存中）' : 'ゲスト利用中（端末にのみ保存）'}
      </div>

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
        <ParentTaskCard key={task.id} task={task} onToggle={toggleSubtask} onDelete={deleteTask} />
      ))}

      {modalOpen && analysis ? (
        <SituationModal
          task={pendingTitle}
          analysis={analysis}
          onSelect={handleSelectSituation}
          onClose={() => {
            setModalOpen(false)
            setAnalysis(null)
            setPendingTitle('')
          }}
        />
      ) : null}
    </div>
  )
}
