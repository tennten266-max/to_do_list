# 15分タスク分解 ToDo

抽象的なタスクを、15分以内で完了できる具体的な行動ステップに分解する Next.js アプリです。

## セットアップ

```bash
npm install
cp .env.example .env.local
```

`.env.local` に xAI の `XAI_API_KEY` を設定します。モデルは `grok-2` です。利用できない場合は `XAI_MODEL` に xAI アカウントで利用可能なモデル名を指定してください。

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。
