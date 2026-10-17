# Agent Instructions

## Project

- This is a Next.js 16 App Router application using React 19, TypeScript, and Tailwind CSS 4.
- The product decomposes broad tasks into concrete steps that take 15 minutes or less. User-facing text is primarily Japanese; preserve that convention.
- Read [README.md](README.md) for setup and environment variables before changing runtime behavior; keep detailed setup instructions there.
- The current AI provider is Groq through the OpenAI-compatible SDK. Use `GROQ_API_KEY` and optional `GROQ_MODEL` (default `openai/gpt-oss-120b`), not xAI settings.
- Supabase is used for authentication and logged-in task storage. Guest tasks are stored in `localStorage` and synchronized after login.

## Commands

- Install dependencies with `npm install` and keep `package-lock.json` in sync with dependency changes.
- For Windows PowerShell setup, copy `.env.example` with `Copy-Item .env.example .env.local`, then configure the Groq and Supabase variables described in `.env.example`.
- Run `npm run dev` for local development, `npm run lint` for ESLint, `npx tsc --noEmit` for type checking, and `npm run build` for a production-build check.
- Run `npm run start` only after `npm run build`.
- No test runner is configured. When adding behavior, prefer focused tests for pure logic and API validation if a test setup is introduced.
- Apply [supabase/schema.sql](supabase/schema.sql) to the Supabase project before testing authenticated persistence.
- Treat `tsconfig.tsbuildinfo` and other build caches as generated files; do not include them in feature changes.

## Code Boundaries

- Keep `src/app/page.tsx` and `src/app/layout.tsx` focused on page composition, metadata, and the root layout.
- Keep interactive UI, task state, API orchestration, and guest/Supabase persistence in `src/components/TaskDecomposer.tsx` unless a focused extraction is necessary.
- Keep decomposition types, model JSON parsing, and step validation/normalization in `src/lib/decompose.ts`; keep analysis validation and the four-option contract in `src/lib/analyze.ts`.
- Keep Groq/OpenAI-compatible server communication in the route that owns each endpoint under `src/app/api/`: `analyze-task`, `decompose-task`, `redecompose-subtask`, `summarize-task`, and the legacy/alternate `decompose` route.
- Keep authentication UI and callback handling in `src/app/auth/`; use `src/lib/supabase/client.ts` for the browser client.
- Use the existing `@/*` import alias for `src/*` and follow the existing no-semicolon formatting style.

## Runtime and Safety

- The current UI calls `/api/analyze-task`, then may call `/api/summarize-task` and `/api/decompose-task`; child-task re-decomposition calls `/api/redecompose-subtask`. Do not replace this flow with local dummy data unless explicitly requested.
- Guest task and completion state uses `localStorage`; authenticated state is stored in the Supabase `todos` table. The `todos.title` column contains a JSON-serialized task object, not only a display title.
- Keep `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and other server environment variables in server-only code; never expose secrets through client components or `NEXT_PUBLIC_*` variables.
- Validate model output through `parseModelJson`, `normalizeTaskAnalysis`, or `normalizeSteps` before returning or rendering it. These paths support plain JSON and fenced JSON where implemented.
- API response shapes differ: `/api/analyze-task` returns normalized analysis, `/api/decompose-task` and `/api/redecompose-subtask` return step arrays, `/api/summarize-task` returns `{ summary }`, and `/api/decompose` returns `{ steps }`. Preserve the existing shape when changing consumers.
- `/api/decompose-task` performs generation, review, and optional regeneration; preserve the 3-to-5-step and 1-to-15-minute constraints. `/api/redecompose-subtask` uses its own 2-to-5-step constraint.
- Keep user-facing API errors separate from sensitive provider or exception diagnostics; do not return raw exception messages from an API response.
- Preserve the API's 3-to-5-step and 1-to-15-minute constraints unless the product requirement explicitly changes them.
- `src/middleware.ts` currently targets `/dashboard`, although that route is not present; check this before changing authentication protection.

## Change Checks

- For UI changes, inspect the client component and verify loading, empty, error, modal, and completion states.
- For decomposition changes, check malformed JSON, fenced JSON, invalid steps, and boundary minute values.
- For analysis changes, check missing task input, malformed model output, and exactly four options when clarification is needed.
- Run `npm run lint` and `npx tsc --noEmit` after changes; run `npm run build` when changing routing, configuration, dependencies, or server behavior.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
