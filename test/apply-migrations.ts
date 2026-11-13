import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// 未適用のマイグレーションだけが適用されるので、複数回実行されても問題ない
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
