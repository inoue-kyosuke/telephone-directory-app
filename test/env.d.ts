// テスト専用のバインディング（vitest.config.ts で追加している）
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
