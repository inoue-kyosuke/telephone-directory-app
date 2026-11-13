# Cloudflare 側の設定手順

勉強会の参加者が、**自分の Cloudflare アカウント**で行う設定をまとめる。方針は [account-policy.md](./account-policy.md) を参照。

> 2026年10月に、日本語表示のダッシュボードで実際に操作して確認した手順。画面の名前や場所は変わることがあるので、見つからない場合は末尾の参考リンクを確認すること。

## 全体の流れ

```text
ブラウザ ──▶ Cloudflare Access（ログイン画面: Google / ワンタイム PIN など）
                │ ログインに成功すると Cf-Access-Jwt-Assertion ヘッダーを付けて転送
                ▼
            自分の Worker（JWT を検証し、メールアドレスでユーザーを識別）──▶ D1
```

| 段階                                | やること                                                                   | いつ             |
| ----------------------------------- | -------------------------------------------------------------------------- | ---------------- |
| 1. アカウントの準備                 | Cloudflare アカウント、workers.dev サブドメイン、Zero Trust、API トークン  | 勉強会の前日まで |
| 2. ログイン方法（任意）             | Google でログインしたい場合だけ、Google Cloud で OAuth を設定              | 勉強会の前日まで |
| 3. Worker と D1 を作ってデプロイ    | `npm run setup` → `npm run deploy`（この時点では 500 が返るのが正常）      | 勉強会当日       |
| 4. Access で保護して再デプロイ      | Access アプリケーションを作成し、チームドメインと AUD タグを設定してデプロイ | 勉強会当日       |

## 1. アカウントの準備

### 1-1. Cloudflare アカウントを作成し、workers.dev サブドメインを決める

1. <https://dash.cloudflare.com/sign-up> でアカウントを作成する（無料プラン）。
2. ダッシュボードで **Workers & Pages** を開き、アカウントの workers.dev サブドメインを決める（設定から後で変更もできる）。
   - アプリの URL は `https://<Worker 名>.<サブドメイン>.workers.dev` になる。
   - サブドメインはアカウント内のすべての Worker に共通なので、**アプリ名ではなく個人名など**にするとよい（例: `kmasuoka` → `call-memo-book.kmasuoka.workers.dev`）。
   - 変更が反映されるまで少し時間がかかることがある。

> **「新しいものを作成」（Connect GitHub / Hello World を開始する / テンプレートを選択 など）は選ばない。**
> Worker はダッシュボードではなく、コンテナ内の `npm run deploy` で作成する。ダッシュボードで作ると、別のコードの Worker ができてしまう。

### 1-2. Zero Trust を有効にする

1. ダッシュボードから **Zero Trust** を開き、チーム名を決めて **Free プラン**を選ぶ。支払い情報の入力を求められる場合がある（無料の範囲では請求されない）。
2. **インテグレーション → ID プロバイダー**を開く。
   - 最初から **Cloudflare**（Cloudflare アカウントでログインする方式）が登録されている。
   - 他に何も追加しなければ、**ワンタイム PIN**（メールで届くコードでログインする方式）が既定のログイン方法になる。
   - 勉強会ではこのままでよい。Google でログインしたい場合だけ「2.」を行う。

### 1-3. API トークンを発行する

1. API トークンの画面を開く。次のどちらで作ってもよい。
   - **My Profile → API Tokens**（ユーザーのトークン）
   - **Manage Account → API Tokens**（アカウントのトークン）
2. **Create Token** → テンプレート **Edit Cloudflare Workers** の **Use template** を選ぶ。
3. 権限（Permissions）に **Account → D1 → Edit** を追加する。
   - **テンプレートには D1 の権限が含まれていない。** 追加し忘れると、`npm run setup` が `Authentication error [code: 10000]` で失敗する。
4. **Account Resources** は自分のアカウントを選ぶ。**Zone Resources** は今回使わない。
5. **Continue to summary → Create Token** を選ぶ。
6. 表示されたトークンをすぐにコピーし、`.env` の `CLOUDFLARE_API_TOKEN` に入れる。**トークンは一度しか表示されない。**

> 権限が足りなかった場合は、トークンを**編集**して権限を追加すればよい。トークンの値は変わらないので、`.env` の書き換えは不要。

### 1-4. アカウント ID を確認する

1. **Workers & Pages** の一覧画面の右側に表示されている **Account ID** をコピーし、`.env` の `CLOUDFLARE_ACCOUNT_ID` に入れる。
2. `.env` はコンテナを作るときにしか読まれないので、コンテナを作り直す。
   - Dev Containers: **Dev Containers: Rebuild Container**
   - compose: `docker compose up -d --force-recreate`
3. コンテナ内で `npx wrangler whoami` を実行し、自分のアカウント名と ID が表示されることを確認する。

## 2. Google でログインする場合（任意）

ワンタイム PIN や Cloudflare アカウントでのログインで進める場合は飛ばしてよい。

### 2-1. Google Cloud で OAuth クライアントを作成する

1. [Google Cloud コンソール](https://console.cloud.google.com/)で新しいプロジェクトを作成する。
2. **APIs & Services → Credentials → Configure Consent Screen** を開く。
   - アプリ名とサポート用メールアドレスを入力する。
   - 対象（Audience）は **External** を選ぶ。
   - 公開ステータスはテスト中のままでよい。その場合は **テストユーザーに自分の Gmail アドレスを追加する**（テストユーザー以外はログインできない）。
3. **Create OAuth client** を選び、次のように設定する。
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://<チーム名>.cloudflareaccess.com`
   - Authorized redirect URIs: `https://<チーム名>.cloudflareaccess.com/cdn-cgi/access/callback`
4. 作成したクライアントの **Client ID** と **Client secret** をコピーする。Client secret はパスワードと同じように扱う。

チーム名（チームドメイン）の確認方法は「4-3.」を参照。

### 2-2. Zero Trust に Google を追加する

1. **インテグレーション → ID プロバイダー → ID プロバイダーを追加する → Google** を選ぶ。
2. **App ID** に Client ID、**Client secret** に Client secret を入力して保存する。
3. 一覧の Google の横にある **テスト** で、ログインできることを確認する。

> **Google** は個人の Gmail を含む任意の Google アカウントでログインできる方式。会社の **Google Workspace** は本採用時に会社アカウントで設定する（[account-policy.md「6. 本採用アプリの本番化」](./account-policy.md#6-本採用アプリの本番化会社アカウント)）。

## 3. Worker と D1 を作ってデプロイする

コンテナ内で実行する（`docker compose` 運用なら先頭に `docker compose exec app` を付ける）。

1. Worker と D1 を作成する。

   ```sh
   npm run setup
   ```

   - **Worker 名**を入力する（例: `call-memo-book`）。URL は `https://<Worker 名>.<サブドメイン>.workers.dev` になる。
   - **D1 名**は Enter で `<Worker 名>-db` になる。
   - `Your database may not be available to serve requests during the migration, continue?` と聞かれたら **y**。ローカル D1 への適用なので影響はない。
   - 2回実行しても壊れない（作成済みの D1 はそのまま使う）。途中で失敗したら、原因を直してもう一度実行すればよい。

2. デプロイする。

   ```sh
   npm run deploy
   ```

   - マイグレーションの確認が出たら **y**（まだ誰も使っていないので影響はない）。
   - 表示された `https://<Worker 名>.<サブドメイン>.workers.dev` を開くと、**500「Server misconfiguration」が表示される。これが正常。** Access の値が空のうちは、アプリがすべてのリクエストを拒否する。

## 4. Access で保護して再デプロイする

### 4-1. Access アプリケーションを作成する

1. Zero Trust の **Access コントロール → アプリケーション → 新規アプリケーションを作成 → セルフホスト**を選ぶ。
2. **宛先**: 「＋ パブリック ホスト名を追加」を選び、次のように入力する。
   - サブドメイン: `<Worker 名>`（例: `call-memo-book`）
   - ドメイン: `<サブドメイン>.workers.dev`（例: `kmasuoka.workers.dev`）
   - パス: 空のまま
   - 最初から表示されている「Workers」の行は使わない（削除できれば削除する）。
3. **Access ポリシー**: **新しいポリシーを作成**を選ぶ。
   - ポリシー名: 任意（例: `自分のみ許可`）
   - アクション: **Allow**
   - ルール → 含める（Include）: セレクター **メール**、値に**ログインに使う自分のメールアドレス**
   - **「全員」や、`@gmail.com` のような一般的なドメインの指定はしないこと。** 世界中のユーザーがアクセスできてしまう。
   - ポリシーを別画面で作った場合は、アプリケーションの画面に戻って「既存のポリシーを追加」から選ぶ。
4. **認証**: 使えるログイン方法（ID プロバイダー）を確認する。既定の「すべてを選択」のままでよい。
5. **詳細**: 名前を入力（例: `call-memo-book`）し、**保存**する。

### 4-2. AUD タグをコピーする

作成したアプリケーションを開き、**追加設定**タブにある**アプリケーション オーディエンス (AUD) タグ**をコピーする（64文字ほどの英数字）。

> ポリシー一覧に表示される「ポリシー ID」（ハイフン付きの文字列）は AUD タグではない。

### 4-3. チームドメインを確認する

**Access コントロール → Access 設定**の「App Launcher を管理する」の説明文に、`<チーム名>.cloudflareaccess.com` が表示されている。これがチームドメイン。

### 4-4. 値を設定して再デプロイする

1. `wrangler.jsonc` の `vars` に設定する。

   ```jsonc
   "vars": {
     "ENVIRONMENT": "production",
     "ACCESS_TEAM_DOMAIN": "<チーム名>.cloudflareaccess.com",
     "ACCESS_AUD": "<AUD タグ>"
   }
   ```

2. もう一度デプロイする: `npm run deploy`
3. `https://<Worker 名>.<サブドメイン>.workers.dev` を開く。Access のログイン画面でログインし、**画面右上に自分のメールアドレスが表示されれば完了**。メモの登録・削除もできることを確認する。

> `wrangler dev`（ローカル）は Access を経由しないため、JWT ヘッダーは届かない。ローカルでは `.dev.vars` の `ENVIRONMENT=local` により検証をスキップし、`DEV_USER_EMAIL` のダミーユーザーとして動く。Access と JWT の動作は、workers.dev にデプロイして確認する。

## うまくいかないとき

| 症状                                                       | 原因と対処                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run setup` で `Authentication error [code: 10000]`    | API トークンに D1 の権限がない。トークンを編集して **Account → D1 → Edit** を追加する（「1-3.」）                  |
| `D1 の一覧を取得できませんでした`                          | 上と同じか、`.env` の値が違う。`npx wrangler whoami` でアカウントを確認する                                         |
| ブラウザで 404 が返る                                      | まだデプロイしていない、またはサブドメインの変更が反映されていない                                                  |
| ログイン画面が出ない                                       | Access アプリケーションの宛先（ホスト名）が Worker の URL と一致していない                                          |
| ログイン後に「アクセス権がない」と表示される               | ポリシーの「メール」に、ログインしたアドレスが入っていない                                                          |
| ログイン後に 500「Server misconfiguration」                | `wrangler.jsonc` の `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` が空のままデプロイされている                                |
| ログイン後に 403「Forbidden」                              | AUD タグかチームドメインが違う。`npx wrangler tail` でログを見ると、`unexpected "aud"` などの理由が出る              |

## 確認状況

2026年10月のリハーサルで確認した事項と、未確認の事項。

- [x] 「Edit Cloudflare Workers」＋ D1 Edit の API トークンで `npm run setup` / `npm run deploy` が成功する
- [x] Access 設定前のデプロイでは 500 が返る
- [x] パブリック ホスト名で保護した Access アプリケーション経由で、Google ログインしてアプリを利用できる（JWT の検証が通る）
- [ ] ワンタイム PIN でのログイン
- [ ] 許可していないメールアドレスが拒否されること
- [ ] `npm run destroy` による削除
- [ ] 宛先を「Workers」（Worker を選ぶ方式）にした場合に JWT ヘッダーが届くか

## 参考リンク

- [Access の JWT の検証](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Google をログイン方法として追加する](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/)
- [Cloudflare Access（Workers）](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [API トークンの作成](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Workers の料金と上限](https://developers.cloudflare.com/workers/platform/pricing/)
