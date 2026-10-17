# タスク分解 ToDo

抽象的なタスクを、実行可能な具体的行動ステップに分解する Next.js アプリです。各ステップの所要時間は現実的な分数で見積もり、15分以内には制限しません。

## セットアップ

```bash
npm install
cp .env.example .env.local
```

`.env.local` に `.env.example` の値を設定してください。AI APIには `GROQ_API_KEY` が必要で、モデルは `GROQ_MODEL` で指定できます（既定値: `openai/gpt-oss-120b`）。ログイン・タスク保存にはSupabase URLとanon key、AI APIのrate limitにはサーバー専用の `SUPABASE_SECRET_KEY` が必要です。Secret Keyは `NEXT_PUBLIC_` 変数に設定せず、クライアントへ公開しないでください。

新規環境では `supabase/schema.sql` を適用してください。既存環境ではタスク保存用テーブルを再作成せず、rate limit用の `supabase/migrations/20260926000000_ai_rate_limits.sql` を適用します。このmigrationは全AI APIで共有するIP単位のrate limit（30リクエスト/10分）を設定します。ローカル開発環境では `SUPABASE_SECRET_KEY` またはRPCが利用できない場合も同じ回数制限のプロセス内rate limitで動作しますが、ProductionではSupabaseの共有rate limit設定がない場合に安全側に停止します。Vercelでは `GROQ_API_KEY`、`NEXT_PUBLIC_SUPABASE_URL`、サーバー専用の `SUPABASE_SECRET_KEY` を登録し、上記migrationをSupabaseプロジェクトへ適用してください。

### Supabase Authのメール認証設定

ブラウザー側のSupabaseクライアントは `@supabase/ssr` を使用し、PKCEフローでセッションをCookieに保存します。新規登録とマジックリンクは現在のページのオリジンから `/auth/callback` を指定し、コールバックで認証コードをセッションに交換します。PKCE検証子は認証を開始したブラウザーに保存されるため、メールのリンクは同じブラウザー／端末で開いてください。認証先のオリジンは環境ごとにブラウザーから取得するため、認証用の追加環境変数は不要です。VercelのProduction／Preview環境には既存の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を登録してください。

Supabase Dashboardの **Authentication > URL Configuration** で次のように設定してください（[Redirect URLsの公式ガイド](https://supabase.com/docs/guides/auth/redirect-urls)）。

- **Site URL**: Vercelの **Project > Settings > Domains** に表示される実際の本番ドメインのオリジン（例のドメインをそのまま設定しないでください）
- **Redirect URLs**: `http://localhost:3000/auth/callback` と、実際の本番ドメインに `/auth/callback` を付けたURLを追加
- Preview Deploymentも使う場合は、実際のVercelチーム／アカウントのslugに限定したコールバックURLパターンを追加するか、確認済みのPreview URLを個別登録

確認メール／ログインリンクが届かない場合は、**Authentication > Sign In / Providers > Email** でEmail Providerが有効であること、メール確認を使う場合は **Confirm email** が有効であることを確認してください。Supabase標準SMTPは本番配信向けではなく、プロジェクトチームの事前承認済み宛先に限定され、送信数にも制限があります。一般利用者へ送信するには **Project Settings > Authentication > SMTP Settings** で独自SMTPを設定してください（[Supabase SMTP公式ガイド](https://supabase.com/docs/guides/auth/auth-smtp)）。Resendを利用する場合も、問い合わせメール用の `RESEND_API_KEY` を設定するだけではSupabase Authの配信設定にはなりません。ResendのSMTPホスト・認証情報・認証済み送信元をSupabaseのSMTP設定に登録します。

**Authentication > Email Templates** で、次の2つのテンプレートを個別に設定してください（[メールテンプレートの公式ガイド](https://supabase.com/docs/guides/auth/auth-email-templates)）。リンクはPKCEコールバックと連携するSupabase公式テンプレート変数 `{{ .ConfirmationURL }}` を使います。リンク先を直接組み立てたり、`{{ .TokenHash }}` に置き換えたりしないでください。

**Confirm signup**

- Subject: `ToDoアプリへのご登録ありがとうございます`
- Body:

```html
<h2>ToDoアプリへのご登録ありがとうございます</h2>
<p>ご登録ありがとうございます。このメールアドレスを確認するため、以下のリンクから登録を完了してください。</p>
<p><a href="{{ .ConfirmationURL }}">登録を完了する</a></p>
```

**Magic Link**

- Subject: `ToDoアプリへのログインリンク`
- Body:

```html
<h2>ToDoアプリへのログインリンク</h2>
<p>ログインのリクエストを受け付けました。以下のリンクからログインしてください。心当たりがない場合は、このメールを無視してください。</p>
<p><a href="{{ .ConfirmationURL }}">ログインする</a></p>
```

メールの送信先はコードから指定しますが、SMTP、URL許可リスト、メールテンプレートはSupabase Dashboard側の設定です。このリポジトリからDashboard設定や実際のメール配信状況は確認・変更できません。

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
