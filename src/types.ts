// Hono アプリ全体で使う型定義

export type AppEnv = {
  // wrangler.jsonc から渡される値（型は `wrangler types` が生成する Env）
  // DEV_USER_EMAIL はローカル専用で .dev.vars にのみ書くため、ここで追加する
  Bindings: Env & { DEV_USER_EMAIL?: string };
  Variables: {
    // Access で認証されたユーザーのメールアドレス
    userEmail: string;
  };
};
