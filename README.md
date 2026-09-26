# タスク分解 ToDo

抽象的なタスクを、実行可能な具体的行動ステップに分解する Next.js アプリです。各ステップの所要時間は現実的な分数で見積もり、15分以内には制限しません。

## セットアップ

```bash
npm install
cp .env.example .env.local
```

`.env.local` に `.env.example` の値を設定してください。AI APIには `GROQ_API_KEY` が必要で、モデルは `GROQ_MODEL` で指定できます（既定値: `openai/gpt-oss-120b`）。ログイン・タスク保存にはSupabase URLとanon key、AI APIのrate limitにはサーバー専用の `SUPABASE_SECRET_KEY` が必要です。Secret Keyは `NEXT_PUBLIC_` 変数に設定せず、クライアントへ公開しないでください。

新規環境では `supabase/schema.sql` を適用してください。既存環境ではタスク保存用テーブルを再作成せず、rate limit用の `supabase/migrations/20260926000000_ai_rate_limits.sql` を適用します。このmigrationは全AI APIで共有するIP単位のrate limit（30リクエスト/10分）を設定します。レート制限用のSupabase設定またはSQLが利用できない場合、AI APIは安全側に停止します。

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。
