# タスク分解 ToDo

抽象的なタスクを、実行可能な具体的行動ステップに分解する Next.js アプリです。各ステップの所要時間は現実的な分数で見積もり、15分以内には制限しません。

## セットアップ

```bash
npm install
cp .env.example .env.local
```

`.env.local` に `.env.example` の値を設定してください。AI APIには `GROQ_API_KEY` が必要で、モデルは `GROQ_MODEL` で指定できます（既定値: `openai/gpt-oss-120b`）。ログイン・タスク保存にはSupabase URLとanon key、AI APIのrate limitにはサーバー専用の `SUPABASE_SECRET_KEY` が必要です。Secret Keyは `NEXT_PUBLIC_` 変数に設定せず、クライアントへ公開しないでください。

新規環境では `supabase/schema.sql` を適用してください。既存環境ではタスク保存用テーブルを再作成せず、rate limit用の `supabase/migrations/20260926000000_ai_rate_limits.sql` を適用します。このmigrationは全AI APIで共有するIP単位のrate limit（30リクエスト/10分）を設定します。レート制限用のSupabase設定またはSQLが利用できない場合、AI APIは安全側に停止します。

### 制作者へのお問い合わせメール

問い合わせフォームを利用するには、ResendのアカウントでAPIキーを作成し、送信元に使うドメインを認証してください。`.env.local` に次のサーバー専用環境変数を設定します。

- `RESEND_API_KEY`: Resendで発行したAPIキー
- `CONTACT_EMAIL`: 問い合わせを受信するメールアドレス
- `CONTACT_FROM_EMAIL`: Resendで認証済みのドメインを使った送信元メールアドレス

`.env.example` にあるこの3つの値はプレースホルダーです。実際の値に置き換えてください。これらの変数に `NEXT_PUBLIC_` を付けないでください。Vercelで利用する場合は、プロジェクトの Settings > Environment Variables に上記3つを登録し、再デプロイしてください。

問い合わせの連続送信はIPアドレスごとに10分間で5回までに制限しています。この制限はアプリケーションプロセス内で管理するため、複数インスタンスやサーバーレスのコールドスタートをまたぐ一元的な制限ではありません。より強い制限が必要な公開環境では、プラットフォーム側のWAFや共有ストアによる制限を追加してください。

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。
