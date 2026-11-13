// npm run destroy
// 確認の後、wrangler.jsonc に設定されている自分の Worker と D1 を削除する。
// 削除後は wrangler.jsonc をプレースホルダに戻す。

import {
  fail,
  getD1Index,
  isConfigured,
  listD1Databases,
  PLACEHOLDERS,
  prompt,
  readWranglerConfig,
  requireCloudflareEnv,
  updateWranglerConfig,
  WRANGLER_CONFIG,
  wrangler,
} from "./lib.ts";

requireCloudflareEnv();

const { config } = readWranglerConfig();
if (!isConfigured(config)) {
  fail(`${WRANGLER_CONFIG} が設定されていないため、削除対象がありません。`);
}
const d1Index = getD1Index(config);
const workerName = config.name;
const databaseName = config.d1_databases[d1Index]?.database_name ?? "";

console.log(`
以下を Cloudflare から削除します。元に戻せません（D1 のデータも消えます）。
  Worker: ${workerName}
  D1    : ${databaseName}
`);
const answer = await prompt(`削除する場合は Worker 名「${workerName}」を入力してください: `);
if (answer !== workerName) fail("入力が一致しないため中止しました。");

wrangler(["delete", "--name", workerName, "--force"]);

if (listD1Databases().some((db) => db.name === databaseName)) {
  wrangler(["d1", "delete", databaseName, "--skip-confirmation"]);
} else {
  console.log(`D1「${databaseName}」は既に存在しません。`);
}

updateWranglerConfig([
  [["name"], PLACEHOLDERS.workerName],
  [["d1_databases", d1Index, "database_name"], PLACEHOLDERS.databaseName],
  [["d1_databases", d1Index, "database_id"], PLACEHOLDERS.databaseId],
]);
console.log(`\n削除しました。${WRANGLER_CONFIG} をテンプレートの状態に戻しました。`);
