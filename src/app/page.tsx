import TaskDecomposer from '@/components/TaskDecomposer'

export default function HomePage() {
  return (
    <main className="mx-auto min-h-svh w-full max-w-2xl px-3 py-6 sm:px-6 sm:py-8">
      <header className="mb-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-orange-500 uppercase">ToDo</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
          to doを細分化する
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          「就活する」のようにアバウトな入力なら、状況の4択から具体的なToDoに分けます。
        </p>
      </header>
      <TaskDecomposer />
    </main>
  )
}
