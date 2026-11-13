// npm run deploy
// リモート D1 にマイグレーションを適用してから、Worker をデプロイする。

import {
  DB_BINDING,
  fail,
  isConfigured,
  readWranglerConfig,
  requireCloudflareEnv,
  WRANGLER_CONFIG,
  wrangler,
} from "./lib.ts";

requireCloudflareEnv();

const { config } = readWranglerConfig();
if (!isConfigured(config)) {
  fail(`${WRANGLER_CONFIG} がまだ設定されていません。先に npm run setup を実行してください。`);
}

wrangler(["d1", "migrations", "apply", DB_BINDING, "--remote"]);
wrangler(["deploy"]);
