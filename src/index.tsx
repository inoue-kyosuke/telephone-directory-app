import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { accessAuth } from "./middleware/access.ts";
import { items } from "./routes/items.tsx";
import type { AppEnv } from "./types.ts";

const app = new Hono<AppEnv>();

app.use(logger());
app.use(secureHeaders());
// すべてのルートで Access の JWT を検証する
app.use(accessAuth());
// フォーム POST を同一オリジンからのものに限定する
app.use(csrf());

app.route("/", items);

export default app;
