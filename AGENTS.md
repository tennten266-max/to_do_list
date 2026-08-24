# Agent Instructions

## Project

- This is a Next.js 16 App Router application using React 19, TypeScript, and Tailwind CSS 4.
- The product decomposes broad tasks into concrete steps that take 15 minutes or less. User-facing text is primarily Japanese; preserve that convention.
- Read [README.md](README.md) for setup and environment variables before changing runtime behavior; keep detailed setup instructions there.

## Commands

- Install dependencies with `npm install` and keep `package-lock.json` in sync with dependency changes.
- For Windows PowerShell setup, copy `.env.example` with `Copy-Item .env.example .env.local`, then set `XAI_API_KEY` in `.env.local`.
- Run `npm run dev` for local development, `npm run lint` for ESLint, `npx tsc --noEmit` for type checking, and `npm run build` for a production-build check.
- Run `npm run start` only after `npm run build`.
- No test runner is configured. When adding behavior, prefer focused tests for pure logic and API validation if a test setup is introduced.

## Code Boundaries

- Keep `src/app/page.tsx` and `src/app/layout.tsx` focused on page composition, metadata, and the root layout.
- Keep interactive UI and in-memory task state in `src/components/TaskDecomposer.tsx`.
- Keep task fixtures and vague-task classification in `src/lib/dummyTodos.ts`.
- Keep decomposition types, model JSON parsing, and step validation/normalization in `src/lib/decompose.ts`; keep analysis validation in `src/lib/analyze.ts`.
- Keep xAI/OpenAI-compatible server communication in the route that owns each endpoint under `src/app/api/`. The routes are `analyze-task`, `decompose-task`, and `decompose`.
- Use the existing `@/*` import alias for `src/*` and follow the existing no-semicolon formatting style.

## Runtime and Safety

- The current UI creates dummy subtasks locally and does not call `/api/analyze-task`, `/api/decompose-task`, or `/api/decompose`; do not wire an API into normal submission unless explicitly requested.
- Client task and completion state is not persisted across reloads. Treat persistence as an explicit design change.
- Keep `XAI_API_KEY` and other server environment variables in server-only code; never expose them through client components or `NEXT_PUBLIC_*` variables.
- Validate model output through `parseModelJson`, `normalizeTaskAnalysis`, or `normalizeSteps` before returning or rendering it. These paths support plain JSON and fenced JSON where implemented.
- API response shapes differ: `/api/analyze-task` returns normalized analysis, `/api/decompose-task` returns a steps array, and `/api/decompose` returns `{ steps }`. Preserve the existing shape when changing consumers.
- `XAI_MODEL` is optional, but fallback models currently differ: `/api/decompose` uses `grok-beta`, while the other two routes use `grok-2-1212`.
- Keep user-facing API errors separate from sensitive provider or exception diagnostics; do not return raw exception messages from an API response.
- Preserve the API's 3-to-5-step and 1-to-15-minute constraints unless the product requirement explicitly changes them.

## Change Checks

- For UI changes, inspect the client component and verify loading, empty, error, modal, and completion states.
- For decomposition changes, check malformed JSON, fenced JSON, invalid steps, and boundary minute values.
- For analysis changes, check missing task input, malformed model output, and exactly four options when clarification is needed.
- Run `npm run lint` and `npx tsc --noEmit` after changes; run `npm run build` when changing routing, configuration, dependencies, or server behavior.
