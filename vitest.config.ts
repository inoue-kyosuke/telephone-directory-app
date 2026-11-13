import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  // テスト開始時にローカル D1 へ適用するマイグレーション
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // .dev.vars の内容に左右されないよう、テスト用の値をここで固定する
          bindings: {
            ENVIRONMENT: "test",
            ACCESS_TEAM_DOMAIN: "",
            ACCESS_AUD: "",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
