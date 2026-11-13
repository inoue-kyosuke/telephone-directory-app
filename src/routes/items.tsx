// CRUD サンプル: items テーブルの一覧・登録・削除

import { Hono } from "hono";
import type { AppEnv } from "../types.ts";
import { Layout } from "../views/Layout.tsx";

export const TITLE_MAX_LENGTH = 200;

type Item = {
  id: number;
  title: string;
  created_by: string;
  created_at: string;
};

export const items = new Hono<AppEnv>();

items.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, title, created_by, created_at FROM items ORDER BY id DESC",
  ).all<Item>();
  const error = c.req.query("error");

  return c.html(
    <Layout title="Items" userEmail={c.var.userEmail}>
      <form method="post" action="/items">
        <input name="title" required maxlength={TITLE_MAX_LENGTH} placeholder="タイトル" />{" "}
        <button type="submit">追加</button>
      </form>
      {error && <p class="error">タイトルは1〜{TITLE_MAX_LENGTH}文字で入力してください。</p>}
      <ul>
        {results.map((item) => (
          <li>
            <span>
              {item.title}
              <br />
              <small>
                {item.created_by} / {item.created_at}
              </small>
            </span>
            <form class="inline" method="post" action={`/items/${item.id}/delete`}>
              <button type="submit">削除</button>
            </form>
          </li>
        ))}
      </ul>
    </Layout>,
  );
});

items.post("/items", async (c) => {
  const body = await c.req.parseBody();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title === "" || title.length > TITLE_MAX_LENGTH) {
    return c.redirect("/?error=title", 303);
  }

  // 作成者には Access から取得したメールアドレスを保存する
  await c.env.DB.prepare("INSERT INTO items (title, created_by) VALUES (?, ?)").bind(title, c.var.userEmail).run();
  return c.redirect("/", 303);
});

items.post("/items/:id{[0-9]+}/delete", async (c) => {
  await c.env.DB.prepare("DELETE FROM items WHERE id = ?")
    .bind(Number(c.req.param("id")))
    .run();
  return c.redirect("/", 303);
});
