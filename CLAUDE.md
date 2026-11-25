# 電話取次支援アプリ（call-memo-book）

社内の電話取次を支援するWebアプリ。現在は STEP1（会社・担当者・取次設定・取次メモ）を作っている。

## 技術スタック

- Cloudflare Workers + Hono（JSX でサーバーサイドレンダリング）
- Cloudflare D1（SQLite）。マイグレーションは wrangler の `migrations/`
- 認証は Cloudflare Access（JWT）。ローカルでは `.dev.vars` の `DEV_USER_EMAIL` を使う
- TypeScript / Biome（Lint・Format）/ Vitest + `@cloudflare/vitest-plugin`
- Node.js 24（devcontainer / `compose.yaml` で用意される）
- フロント（仕様書 2.3 で決定済み、画面の実装時に導入する）: Tailwind CSS + daisyUI、サーバーとのやりとりは htmx、
  小さなクライアント側の動作は Alpine.js（または hono/jsx/dom）。素の CSS や手書きの fetch で代替しない
- 技術スタックの正は `docs/spec-step1.md` 2.3。ここにない技術を足すときは人に確認する

## コマンド

| 目的 | コマンド |
| --- | --- |
| **全チェック（Lint・Format・型・テスト）** | `npm run check` |
| Format の自動修正 | `npm run format` |
| テストだけ | `npm test` |
| ローカルD1にマイグレーション適用 | `npm run db:migrate:local` |
| ローカルD1にダミーデータ投入 | `npm run db:seed:local` |
| 開発サーバー | `npm run dev`（http://localhost:8787） |

## 作業のルール

- **作業を終える前に必ず `npm run check` を通す。** 落ちたら直してからもう一度実行する。Format の崩れは `npm run format` で直す
- 振る舞いを変えたら、テストを追加・更新する。テストは `test/` に置き、DBを使うテストは本物のローカルD1（テストごとに隔離される）で行う
- 本番環境へのデプロイ（`npm run deploy`）・削除（`npm run destroy`）は、人に言われたときだけ実行する
- `.env` / `.dev.vars` にはシークレットが入っている。中身を出力したりコミットしたりしない
- `seed/` やテストに実在の会社名・人名・電話番号を入れない（架空の値を使う）

## DB・マイグレーション

- テーブル定義の正は `docs/db-design-step1.md`（第6回勉強会で決めた共通テーブル定義を反映済み）
- **適用済みのマイグレーションファイルは書き換えない。** 変更は新しい番号のファイル（`migrations/000N_*.sql`）を追加して行う。追加したら設計書も合わせて直す
- 日時は UTC の ISO 8601 文字列（`YYYY-MM-DDTHH:MM:SSZ`）で保存し、表示時に JST に変換する
- 任意項目の未入力は空文字ではなく `NULL`
- 論理削除は `deleted_at`。検索・一覧・件数には必ず `deleted_at IS NULL` を付ける
- 作成者・更新者・対処者は JWT のメールアドレスを使う。クライアントから送られた値は使わない
- 競合検知は `version`（取次設定だけは変更前の `status`）で、更新件数0なら競合として扱う
- `items` テーブル（`migrations/0001`、`src/routes/items.tsx`）はテンプレートのCRUDサンプル。STEP1 の機能を実装したら削除してよい

## ドキュメント

- 仕様書: `docs/spec-step1.md`
- DB設計: `docs/db-design-step1.md`
- 用語: `GLOSSARY.md`（コード・テスト名・コミットメッセージでもこの用語を使う）
- 勉強会の議事録: `docs/YYYY-MM-DD AI使ってアプリ開発 勉強会*.md`（決定事項の経緯はここにある）
- Cloudflare の初期設定: `docs/cloudflare-setup.md`

仕様書・DB設計・議事録の内容が食い違っていたら、勝手にどちらかに合わせず、人に確認する。

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
