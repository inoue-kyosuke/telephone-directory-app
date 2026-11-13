// npm run setup
// Worker 名と D1 名（省略時は <Worker 名>-db）を受け取り、
// D1 を作成して wrangler.jsonc に書き込む。ローカル D1 にマイグレーションも適用する。
//
// 対話入力:       npm run setup
// 引数で指定:     npm run setup -- --name call-memo-book [--db call-memo-book-db]
// 何度実行しても壊れない（作成済みの D1 はそのまま使う）。

import {
  DB_BINDING,
  fail,
  getArg,
  getD1Index,
  isConfigured,
  listD1Databases,
  NAME_PATTERN,
  prompt,
  readWranglerConfig,
  requireCloudflareEnv,
  updateWranglerConfig,
  WRANGLER_CONFIG,
  wrangler,
} from "./lib.ts";

async function askName(label: string, argName: string, defaultValue?: string): Promise<string> {
  const hint = defaultValue ? `（Enter で ${defaultValue}）` : "";
  const value = getArg(argName) ?? ((await prompt(`${label}${hint}: `)) || defaultValue || "");
  if (!NAME_PATTERN.test(value)) {
    fail(
      `${label}「${value}」は使えません。小文字英数字とハイフンのみ（先頭・末尾・連続ハイフン不可、63文字以内）で入力してください。`,
    );
  }
  return value;
}

requireCloudflareEnv();

const workerName = await askName("Worker 名", "name");
const databaseName = await askName("D1 名", "db", `${workerName}-db`);

console.log(`\nWorker: ${workerName}\nD1    : ${databaseName}`);

// 別の名前で設定済みなら、上書きしてよいか確認する
const { config } = readWranglerConfig();
const d1Index = getD1Index(config);
if (isConfigured(config) && config.name !== workerName) {
  const answer = await prompt(
    `\n${WRANGLER_CONFIG} は既に「${config.name}」で設定されています。「${workerName}」で上書きしますか？ (y/N): `,
  );
  if (answer.toLowerCase() !== "y") fail("中止しました。");
}

// D1 を作成する（作成済みなら再利用する）
let database = listD1Databases().find((db) => db.name === databaseName);
if (database) {
  console.log(`\nD1「${databaseName}」は作成済みです（${database.uuid}）。そのまま使います。`);
} else {
  // wrangler.jsonc はこのスクリプトで書き換えるため、wrangler には設定を変更させない
  // （ローカル開発ではリモートではなくローカルの D1 を使う）
  wrangler(["d1", "create", databaseName, "--location", "apac", "--update-config=false", "--use-remote=false"]);
  database = listD1Databases().find((db) => db.name === databaseName);
  if (!database) fail(`D1「${databaseName}」の作成を確認できませんでした。`);
}

updateWranglerConfig([
  [["name"], workerName],
  [["d1_databases", d1Index, "database_name"], databaseName],
  [["d1_databases", d1Index, "database_id"], database.uuid],
]);
console.log(`\n${WRANGLER_CONFIG} を更新しました。`);

wrangler(["d1", "migrations", "apply", DB_BINDING, "--local"]);

console.log(`
セットアップが完了しました。
  開発サーバー: npm run dev → http://localhost:8787
  デプロイ    : npm run deploy
`);
