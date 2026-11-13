// scripts/ 配下で共通に使う処理

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { applyEdits, type JSONPath, modify, parse } from "jsonc-parser";

export const WRANGLER_CONFIG = "wrangler.jsonc";
export const DB_BINDING = "DB";

export const PLACEHOLDERS = {
  workerName: "your-worker-name",
  databaseName: "your-worker-name-db",
  databaseId: "00000000-0000-0000-0000-000000000000",
} as const;

// Worker 名・D1 名: 小文字英数字とハイフン（先頭・末尾・連続ハイフン不可）。workers.dev のホスト名に使うため63文字以内
export const NAME_PATTERN = /^(?=.{1,63}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type WranglerConfig = {
  name: string;
  d1_databases: { binding: string; database_name: string; database_id: string }[];
};

export function readWranglerConfig(): { text: string; config: WranglerConfig } {
  const text = readFileSync(WRANGLER_CONFIG, "utf8");
  return { text, config: parse(text) as WranglerConfig };
}

// コメントを残したまま wrangler.jsonc の値を書き換える
export function updateWranglerConfig(changes: [JSONPath, unknown][]): void {
  let text = readFileSync(WRANGLER_CONFIG, "utf8");
  for (const [path, value] of changes) {
    text = applyEdits(text, modify(text, path, value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
  }
  writeFileSync(WRANGLER_CONFIG, text);
}

export function getD1Index(config: WranglerConfig): number {
  const index = config.d1_databases.findIndex((db) => db.binding === DB_BINDING);
  if (index < 0) fail(`${WRANGLER_CONFIG} に binding "${DB_BINDING}" の D1 設定がありません。`);
  return index;
}

export function isConfigured(config: WranglerConfig): boolean {
  const db = config.d1_databases[getD1Index(config)];
  return (
    config.name !== PLACEHOLDERS.workerName &&
    db?.database_name !== PLACEHOLDERS.databaseName &&
    db?.database_id !== PLACEHOLDERS.databaseId
  );
}

// Cloudflare を操作するコマンドの前に、認証情報が渡されているか確認する
export function requireCloudflareEnv(): void {
  const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    fail(
      `環境変数 ${missing.join(", ")} が設定されていません。\n` +
        ".env に値を入れてから、コンテナを再作成してください（README の「前提」を参照）。",
    );
  }
}

const WRANGLER_BIN = "node_modules/.bin/wrangler";

// wrangler を実行し、出力をそのまま表示する。失敗したら終了する。
export function wrangler(args: string[]): void {
  console.log(`\n$ wrangler ${args.join(" ")}`);
  const result = spawnSync(WRANGLER_BIN, args, { stdio: "inherit" });
  if (result.status !== 0) fail(`wrangler ${args[0]} が失敗しました。`);
}

// wrangler を実行し、標準出力を文字列で返す
export function wranglerOutput(args: string[]): string {
  return execFileSync(WRANGLER_BIN, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

export type D1Database = { uuid: string; name: string };

export function listD1Databases(): D1Database[] {
  try {
    return JSON.parse(wranglerOutput(["d1", "list", "--json"])) as D1Database[];
  } catch {
    fail("D1 の一覧を取得できませんでした。.env の API トークン（権限）とアカウント ID を確認してください。");
  }
}

// `--name foo` 形式のコマンドライン引数を読む
export function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export function fail(message: string): never {
  console.error(`\nエラー: ${message}`);
  process.exit(1);
}
